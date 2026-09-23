# scripts/
> L2 | 父级: ../CLAUDE.md

成员清单
docker-common.sh: 统一解析 .env.local/.env/api/.env、校验 chat/.env、封装 Compose 参数并输出 api/chat 双服务 ASCII 启动 Banner
docker-start.sh: 复用公共运维内核，无 Compose 行前缀地构建并前台启动 folune-api-dev 与 folune-chat-dev
docker-stop.sh: 复用公共运维内核，停止双服务 Compose 项目并移除孤儿容器，保留命名卷数据
docker-logs.sh: 默认跟随 api/chat 双服务日志，也支持 api、chat、all 精确选择并拒绝 app 等未编排服务名

职责: 提供 Folune 本地 Docker 开发的稳定命令入口；所有脚本只操作 docker-compose.dev.yml 定义的 folune-api-dev/folune-chat-dev，不执行全局清理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
