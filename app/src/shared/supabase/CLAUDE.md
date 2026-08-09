# app/src/shared/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
client.ts: Supabase 浏览器 client 单例，读取 Vite 环境变量并固定 PKCE、持久会话、自动刷新与显式回调交换策略
auth.ts: 纯 Supabase Auth 服务层，封装邮箱密码登录/注册、邮箱验证码、Google OAuth、PKCE 回调、当前 access token 读取、退出登录与错误文案

职责: 前端 Supabase 认证基础设施边界；Publishable key 只从 Vite 环境变量读取，禁止引入 service_role/secret key，禁止承载 profile 等业务数据读写，access token 只按请求提供给相邻 api/ 中枢。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
