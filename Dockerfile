# 前端构建阶段：产物为纯静态文件
FROM node:22 AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 运行阶段：只保留 Python runtime、后端代码与前端静态文件
FROM python:3.12-slim
WORKDIR /data
ENV ATTEST_DATA_DIR=/data
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/src /app/backend/src
COPY --from=frontend-build /src/frontend/dist/ /app/static/
RUN pip install --no-cache-dir /app/backend
EXPOSE 8321
CMD ["attest"]
