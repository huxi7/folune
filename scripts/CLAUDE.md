# scripts/
> L2 | 父级: ../CLAUDE.md

成员清单
payment-dev-gateway.ts: 开发 HTTPS 隧道的回环窄入口，仅转发支付回调与返回本机订阅页，拒绝其他业务路径，生产模式禁止启动。
reconcile-payments.ts: 服务密钥触发一次持久对账；--local 固定回环 API，--local --watch 提供可终止且不重叠的两分钟开发补查，生产保持外部调度。
check-nowpayments.ts: 检查网关/商户发现/币种数量，账本开关关闭时也可验证已配置数据库角色；分别输出缺失字段与账本/开售开关，不输出秘密。
docker-common.sh: 统一解析 .env.local/.env/api/.env、校验 chat/.env、封装 Compose 参数并输出 api/chat 双服务 ASCII 启动 Banner
docker-start.sh: 复用公共运维内核，无 Compose 行前缀地构建并前台启动 folune-api-dev 与 folune-chat-dev
docker-stop.sh: 复用公共运维内核，停止双服务 Compose 项目并移除孤儿容器，保留命名卷数据
docker-logs.sh: 默认跟随 api/chat 双服务日志，也支持 api、chat、all 精确选择并拒绝 app 等未编排服务名

职责: 提供 Folune 本地开发运维与支付连接预检入口；Docker 脚本只操作 Compose 定义的 folune-api-dev/folune-chat-dev，不执行全局清理，支付脚本复用 API 的配置/网络边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
