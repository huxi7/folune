# [INPUT]: 依赖 api/package.json、api/bun.lock 与 oven/bun:1.3.5
# [OUTPUT]: 提供 Compose 使用的 dev 阶段与 Cloud Run 使用的独立 production 镜像
# [POS]: deploy/docker 的 API 构建入口；开发挂载源码，生产复制源码，凭据始终在运行时注入
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

FROM oven/bun:1.3.5 AS base

WORKDIR /workspace/api

COPY api/package.json api/bun.lock ./

FROM base AS dev
RUN bun install --frozen-lockfile

EXPOSE 10001

CMD ["bun", "run", "dev"]

FROM base AS production
RUN bun install --frozen-lockfile --production
COPY --chown=bun:bun api/src ./src
ENV NODE_ENV=production
USER bun
EXPOSE 8080
CMD ["bun", "run", "start"]
