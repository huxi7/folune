# [INPUT]: 依赖 api/package.json、api/bun.lock 与 oven/bun:1.3.5
# [OUTPUT]: 提供 /workspace/api 下已安装基础依赖、默认运行 bun run dev 的开发镜像
# [POS]: deploy/docker 的 api 基础依赖层；源码由 Compose bind mount 注入，不复制进镜像
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

FROM oven/bun:1.3.5

WORKDIR /workspace/api

COPY api/package.json api/bun.lock ./
RUN bun install --frozen-lockfile

EXPOSE 10001

CMD ["bun", "run", "dev"]
