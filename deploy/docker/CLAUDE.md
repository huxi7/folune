# deploy/docker/
> L2 | 父级: ../CLAUDE.md

成员清单
api.Dockerfile: 基于 oven/bun:1.3.5 冻结安装 api 依赖并暴露 10001，运行时代码由 Compose bind mount 注入
chat.Dockerfile: 基于 oven/bun:1.3.5 冻结安装 Mastra chat 依赖并暴露 10002，源码和密钥由 Compose 分离注入

职责: 保存 api/chat 两个独立服务 Dockerfile；镜像只构建稳定依赖层，开发源码、node_modules 与密钥生命周期由 Compose 管理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
