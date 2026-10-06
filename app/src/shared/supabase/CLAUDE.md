# app/src/shared/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
client.ts: Supabase 浏览器 client 单例，读取 Vite 环境变量并固定 PKCE、持久会话、自动刷新与显式回调交换策略
auth.test.ts: 验证两种 OAuth 共用同源回调、桌面交接与错误传播；只替换 SDK，不请求远程认证
auth.ts: 纯 Supabase Auth 服务层，封装邮箱密码登录/注册、邮箱验证码、Google/GitHub OAuth（共享 PKCE，桌面经系统浏览器）、PKCE 回调、当前 access token 与仅展示的注册时间读取、退出登录与错误文案

职责: 前端 Supabase 认证基础设施边界；Publishable key 只从 Vite 环境变量读取，禁止引入 service_role/secret key，禁止承载 profile 等业务数据读写，access token 只按请求提供给相邻 api/ 中枢。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
