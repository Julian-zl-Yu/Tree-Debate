# ---------- Stage 1: Build ----------
FROM mcr.microsoft.com/openjdk/jdk:17-ubuntu AS build

# 安装 maven
RUN apt-get update \
 && apt-get install -y --no-install-recommends maven ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 先拷 pom.xml 预拉依赖
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline

# 再拷源码并打包
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---------- Stage 2: Runtime ----------
# 注意：这里也用 jdk:17-ubuntu（没有 jre 标签）
FROM mcr.microsoft.com/openjdk/jdk:17-ubuntu

# 工具
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /build/target/*.jar /app/app.jar

# 下载 Cloud SQL Proxy
RUN curl -sfL https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.12.0/cloud-sql-proxy.linux.amd64 \
     -o /usr/local/bin/cloud-sql-proxy \
 && chmod +x /usr/local/bin/cloud-sql-proxy

# 入口脚本：先起 proxy，再起 Spring Boot；绑定 Render 的 $PORT
RUN printf '%s\n' \
'#!/usr/bin/env bash' \
'set -euo pipefail' \
'echo "$GCP_SA_KEY_JSON" > /tmp/gcp-key.json' \
'/usr/local/bin/cloud-sql-proxy --credentials-file=/tmp/gcp-key.json --address 127.0.0.1 --port 3306 "$INSTANCE_CONNECTION_NAME" & sleep 2' \
'echo "Starting Spring Boot on port ${PORT:-8080}..."' \
'exec java ${JAVA_OPTS:-} -Dserver.port=${PORT:-8080} -jar /app/app.jar' \
> /app/entrypoint.sh \
 && chmod +x /app/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
