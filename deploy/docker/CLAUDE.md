# deploy/docker/
> L2 | 父级: ../CLAUDE.md

成员清单
api.Dockerfile: 共用 Bun 1.3.5 基础层；dev 接收 Compose 源码挂载，production 冻结安装运行依赖并复制源码，以非 root 用户执行 start、读取平台 PORT
chat.Dockerfile: dev 保留 Mastra 热更新；build 在目标 Linux 架构生成产物，production 只携带产物和运行依赖，以非 root Bun 执行 index.mjs，密钥运行时注入

职责: 每个服务只有一份多阶段构建定义；Compose 显式选择 dev，云端选择默认的 production 阶段。构建上下文统一为仓库根，所有真实环境值留在运行平台。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
