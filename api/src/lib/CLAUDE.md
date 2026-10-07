# api/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
github.ts: 请求期读取 GitHub 身份与分页主邮箱，拒绝备用/未验证邮箱，不保存 token。
payment-amount.ts: 精确十进制/整数美分转换，拒绝精度损失与超界。
supabase-http.ts: Auth/PostgREST/Storage 共享的完整 HTTP 响应生命周期；GET/HEAD 每次 6 秒且最多两次，写请求 12 秒且不重放；重试使用新连接，读取 body 后才结束期限，定时器随完成释放
CLAUDE.md: 记录基础库适配层职责与文档协议
payment-provider.ts: 单一 NOWPayments client 与真实开售门禁，关闭开售不停止已付权益。
nowpayments.ts: NOWPayments 唯一适配器；创建普通汇率 Invoice 避免固定换汇最低额；无损金额、Invoice/权威查单/完整发现、IPN 验签、固定主机和配置预检；按 2s93JusNJt 用 invoiceId 查单、短期缓存商户 JWT、拦截重复/错币入金；商户币种兼容 selectedCurrencies/大小写和旧 currencies，付款列表预检显式排序以兼容正式接口。
banner.ts: 输出纯 ASCII logo、非敏感运行信息与 ready 路由摘要
supabase-auth.ts: 使用用户 JWT/Publishable key 调用 /auth/v1/user；复用 supabase-http 的完整响应期限和只读重试后返回可信 AuthUser
supabase-rest.ts: 共享 PostgREST 传输；普通资源用户 JWT，支付仓储可传仅限支付权限的服务 JWT。
supabase-storage.ts: 以相同用户 JWT 调用 Storage API 上传/删除 avatars 对象，共享 12 秒完整响应期限且不重放写操作，净化网络错误；集中构造和解析受管公开 URL

职责: 基础设施适配层；普通 PostgREST 与 Storage 以 authenticated 用户身份触发 RLS；支付仓储可使用受限 folune_billing 服务角色，禁止 ORM、数据库驱动、连接串、service role 与业务权限判断。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
