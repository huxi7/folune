# [INPUT]: 依赖 chat 的清单、锁文件、源码、tsconfig 与 oven/bun:1.3.5
# [OUTPUT]: 提供 Compose 的 dev 阶段及只携带 Mastra 构建产物与运行依赖的 production 镜像
# [POS]: deploy/docker 的 Chat 构建入口；构建不读取本地密钥，生产使用 Bun 直接执行产物以保留 Bun 原生能力
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

FROM oven/bun:1.3.5 AS base

WORKDIR /workspace/chat

COPY chat/package.json chat/bun.lock ./

FROM base AS dev
RUN bun install --frozen-lockfile

EXPOSE 10002

CMD ["bun", "run", "dev"]

FROM dev AS build
COPY chat/tsconfig.json ./
COPY chat/src ./src
RUN bun --bun run build

FROM oven/bun:1.3.5 AS production
WORKDIR /workspace/chat
COPY --from=build --chown=bun:bun /workspace/chat/.mastra/output ./
ENV NODE_ENV=production
USER bun
EXPOSE 8080
CMD ["bun", "index.mjs"]
