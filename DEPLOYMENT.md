# SukaaliCheck — Docker Deployment to Digital Ocean

## Architecture

```
GitHub Actions (push to main)
  └── build frontend Docker image (multi-stage: node → nginx:alpine)
  └── push to Docker Hub
  └── SSH into droplet → docker-compose pull && up -d

Digital Ocean Droplet
  ├── frontend container  (nginx:alpine, ports 80 + 443)
  │   ├── serves static files from /usr/share/nginx/html
  │   ├── SPA routing (try_files → /index.html)
  │   └── reverse proxies /api/* → backend:8000
  ├── backend container   (python:3.13-slim, port 8000 internal only)
  └── certbot container   (Let's Encrypt cert issuance + renewal)
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `sukaalicheck/Dockerfile` | Multi-stage build: node builder → nginx:alpine |
| `sukaalicheck/.dockerignore` | Exclude node_modules, .next, out, .env.local |
| `sukaalicheck/nginx.conf` | SPA routing, /api proxy, certbot webroot, gzip, SSL |
| `sukaali-check-backend/Dockerfile` | Python 3.13-slim + uv, runs uvicorn |
| `docker-compose.yml` (repo root) | Orchestrates frontend + backend + certbot |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `sukaalicheck/.env.example` | Documents required build-time env vars |

**No changes needed to `next.config.ts`** — `output: "export"` already triggers on `NODE_ENV=production` (which `npm run build` sets automatically), so static export works in Docker as-is.

---

## Environment Variables

### Build-time (baked into the JS bundle during Docker build)

These are `NEXT_PUBLIC_*` variables — they get inlined into the static HTML/JS at build time and **cannot be changed at runtime**.

| Variable | Example value | How it's set |
|----------|--------------|--------------|
| `NEXT_PUBLIC_API_BASE` | `https://yourdomain.com/api` | GitHub Actions secret → Docker `--build-arg` |

### Runtime — backend only (never in the repo)

Stored in a `.env` file on the droplet, loaded by docker-compose.

| Variable | Example value |
|----------|--------------|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host/db` |
| `JWT_SECRET` | `random-64-char-secret` |
| `CORS_ORIGINS` | `["https://yourdomain.com"]` |

---

## GitHub Secrets to Add

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Description |
|------------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (create at hub.docker.com → Account → Security) |
| `NEXT_PUBLIC_API_BASE` | Production API URL e.g. `https://yourdomain.com/api` |
| `DROPLET_IP` | IP address of the droplet |
| `DROPLET_SSH_KEY` | Private SSH key (full PEM content, the key added to the droplet) |
| `DROPLET_USER` | SSH user — usually `root` |

---

## File Contents

### `sukaalicheck/Dockerfile`

```dockerfile
# Stage 1: build static files
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NODE_ENV=production
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
```

### `sukaalicheck/.dockerignore`

```
node_modules
.next
out
.env.local
.env
*.log
.DS_Store
.git
```

### `sukaalicheck/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;

    # Let's Encrypt webroot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS once cert is in place
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # SPA routing
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    # Proxy API calls to backend container
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> **Note:** For the very first deployment (before the cert exists), comment out the HTTPS server block and use HTTP only. After running certbot, uncomment and redeploy.

### `sukaali-check-backend/Dockerfile`

```dockerfile
FROM python:3.13-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `docker-compose.yml` (repo root)

```yaml
services:
  frontend:
    image: ${DOCKERHUB_USERNAME}/sukaalicheck:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    image: ${DOCKERHUB_USERNAME}/sukaalicheck-backend:latest
    env_file: .env
    expose:
      - "8000"
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Digital Ocean

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./sukaalicheck
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/sukaalicheck:latest
          build-args: |
            NEXT_PUBLIC_API_BASE=${{ secrets.NEXT_PUBLIC_API_BASE }}

      - name: Deploy to droplet via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: ${{ secrets.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            cd /opt/sukaalicheck
            docker-compose pull frontend
            docker-compose up -d frontend
            docker image prune -f
```

### `sukaalicheck/.env.example`

```bash
# Build-time: baked into the static bundle
# Set this as a GitHub Actions secret (NEXT_PUBLIC_API_BASE)
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## One-Time Droplet Setup

Run these steps once when setting up a new droplet.

### 1. Create the droplet
- Ubuntu 22.04 LTS, minimum 1 GB RAM
- Add your SSH public key during creation

### 2. SSH in and install Docker

```bash
ssh root@<DROPLET_IP>
apt update && apt install -y docker.io docker-compose
systemctl enable --now docker
```

### 3. Configure firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### 4. Set up project directory

```bash
mkdir -p /opt/sukaalicheck
cd /opt/sukaalicheck
# Copy docker-compose.yml from the repo (or clone just that file)
```

### 5. Create `.env` for the backend

```bash
cat > /opt/sukaalicheck/.env << 'EOF'
DATABASE_URL=postgresql+psycopg://user:pass@host/dbname
JWT_SECRET=replace-with-64-char-random-secret
CORS_ORIGINS=["https://yourdomain.com"]
EOF
chmod 600 .env
```

### 6. Add GitHub Actions SSH key to the droplet

On your local machine, generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/sukaalicheck_deploy
```

Copy the public key to the droplet:

```bash
ssh-copy-id -i ~/.ssh/sukaalicheck_deploy.pub root@<DROPLET_IP>
```

Add the **private key** content (`~/.ssh/sukaalicheck_deploy`) to GitHub secret `DROPLET_SSH_KEY`.

### 7. Point your domain

Add an **A record** in your DNS provider pointing `yourdomain.com` → `<DROPLET_IP>`.
Wait for propagation (usually 5–30 minutes).

### 8. First deploy (HTTP only)

Before issuing a cert, comment out the HTTPS server block in `nginx.conf`, deploy, then get the cert:

```bash
# On the droplet
cd /opt/sukaalicheck
docker-compose up -d frontend backend

# Issue the cert
docker-compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  --email youremail@example.com \
  --agree-tos --no-eff-email
```

After the cert is issued, uncomment the HTTPS block in `nginx.conf`, rebuild the frontend image, and redeploy via GitHub Actions (or manually run `docker-compose up -d`).

### 9. Set up cert auto-renewal

```bash
# Add to crontab (crontab -e)
0 3 * * * cd /opt/sukaalicheck && docker-compose run --rm certbot renew --quiet && docker-compose exec frontend nginx -s reload
```

---

## Day-to-Day Workflow

1. Make changes locally, commit, push to `main`
2. GitHub Actions builds the Docker image with production env vars baked in
3. Pushes image to Docker Hub
4. SSHs into the droplet and pulls + restarts the frontend container
5. Backend is not redeployed unless you push a backend image too (add a second job to the workflow when the backend is ready)

---

## Local Testing

Test the Docker build locally before pushing:

```bash
cd sukaalicheck
docker build \
  --build-arg NEXT_PUBLIC_API_BASE=http://localhost:8000 \
  -t sukaalicheck:local .

docker run -p 8080:80 sukaalicheck:local
# Visit http://localhost:8080
```

---

## Checklist

- [ ] Create Docker Hub account and generate access token
- [ ] Add all 6 GitHub secrets
- [ ] Create Digital Ocean droplet (Ubuntu 22.04)
- [ ] Install Docker on droplet
- [ ] Generate deploy SSH key pair, add public key to droplet, private key to GitHub
- [ ] Create `/opt/sukaalicheck/.env` on droplet
- [ ] Copy `docker-compose.yml` to droplet
- [ ] Point domain A record to droplet IP
- [ ] Create all files listed in the "Files to Create" table
- [ ] Push to `main` — confirm Actions workflow passes
- [ ] Run certbot on droplet to issue SSL cert
- [ ] Update `nginx.conf` for HTTPS and redeploy
- [ ] Set up certbot cron renewal
