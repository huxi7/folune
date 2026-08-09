# [INPUT]: 依赖 chat/package.json、chat/bun.lock 与 oven/bun:1.3.5
# [OUTPUT]: 提供 /workspace/chat 下已冻结安装基础依赖、默认运行 Mastra dev server 的开发镜像
# [POS]: deploy/docker 的 chat 基础依赖层；源码与本地密钥由 Compose 分别通过 bind mount 和 env_file 注入
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

FROM oven/bun:1.3.5

WORKDIR /workspace/chat

COPY chat/package.json chat/bun.lock ./
RUN bun install --frozen-lockfile

EXPOSE 10002

CMD ["bun", "run", "dev"]
