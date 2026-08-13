# [INPUT]: 依赖 api/package.json、api/bun.lock、api/src 与 oven/bun:1.3.5
# [OUTPUT]: 提供包含完整 API 源码、接受 Cloud Run PORT 注入并执行生产启动命令的独立镜像
# [POS]: api 模块的 Cloud Run 生产容器入口，与 deploy/docker/api.Dockerfile 的 Compose 开发依赖层分工
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

FROM oven/bun:1.3.5

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

ENV NODE_ENV=production

EXPOSE 8080

CMD ["bun", "run", "start"]
