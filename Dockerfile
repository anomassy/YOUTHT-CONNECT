FROM node:22-bookworm-slim AS web-build

WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/web build

FROM python:3.13-slim

WORKDIR /app
COPY artifacts/api-server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY artifacts/api-server ./artifacts/api-server
COPY --from=web-build /workspace/artifacts/web/dist/public ./artifacts/web/dist/public

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 10000
CMD ["sh", "-c", "uvicorn server.main:app --app-dir artifacts/api-server --host 0.0.0.0 --port ${PORT:-10000}"]
