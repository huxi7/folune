# deploy/
> L2 | 父级: ../CLAUDE.md

成员清单
docker/: Docker 镜像定义目录，承载 api/chat 两个 Bun 本地开发基础依赖层；Compose 容器固定命名为 api-dev/chat-dev

职责: 管理 SuperNote 的部署与容器镜像定义；本地开发容器化 api/chat，不在此启动 app 或数据库，服务密钥不进入镜像层。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
