FROM python:3.13-slim
WORKDIR /app

# Install uv
RUN pip install uv

# Install dependencies from lockfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy source
COPY . .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "sukaali_check_backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
