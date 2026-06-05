FROM python:3.11-slim
WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "sukaali_check_backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
