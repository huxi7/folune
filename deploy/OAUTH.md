# Folune OAuth 接入与验收

Google 与 GitHub 共用 Supabase Auth PKCE。
前端只传 provider、回调和 PKCE 参数。
Client Secret 只配置在对应 Supabase Provider。
不写入环境模板、前端或 Git。

## GitHub 应用

2026-10-07 已在 solink7 账号创建两个 OAuth App。
两个应用隔离开发与生产凭据。
Wildcard 和 Device Flow 均未启用。

| 环境 | GitHub OAuth App | Client ID | 授权回调 |
| --- | --- | --- | --- |
| Production | [Folune](https://github.com/settings/applications/3909928) | `Ov23liQgZq6AB2cyyXTg` | `https://ialqliixbdwwmxackjpr.supabase.co/auth/v1/callback` |
| Staging | [Folune Staging](https://github.com/settings/applications/3909958) | `Ov23liXatrkSvkz95UTl` | `https://buauzrzxifgdacntisfq.supabase.co/auth/v1/callback` |

Client ID 是公开标识，不是 Secret。
生产主页为 `https://folune.huxi7.com`。
Staging 主页为 `http://localhost:10000`。

## 当前状态与阻塞

2026-10-07 本人已完成两套 GitHub 验证。
两套 Secret 已填入各自 Supabase Provider。
本轮已核实 Production 与 Staging 的 GitHub、Google 均开启。
Staging 保存前后核对 242 个字段。
只有 GitHub Client ID、Secret 与启用开关变化。
Secret 未写入前端、仓库或验收记录。

## 账号匹配规则

没有匹配账号时，由 Supabase 创建账号。
匹配一个账号时，由 Supabase 自动关联。
匹配多个账号时，回调进入账号选择视图。
用户用邮箱密码或 Google 登录目标账号。
页面显示服务端验证的邮箱并要求确认。
确认后调用 SDK `linkIdentity` 再授权 GitHub。
回调核对目标 user ID 与 GitHub 身份后进入工作区。
不枚举匿名候选，不合并笔记、余额或订阅。
本标签页意图十分钟过期；普通登录清除遗留意图。

两库已启用 `SECURITY_MANUAL_LINKING_ENABLED`。
各库保存前后核对，只有该字段变化。
Google、SMTP、Site URL 与重定向白名单保持原值。
选择页与 Google 验证到确认邮箱的流程已实测。
真实 GitHub 绑定需要用户在页面确认目标账号。
当前代码尚未发布 production。

## 本轮验证

- 27项认证定向测试、7项桌面测试、类型检查、lint与构建通过。
- Production Google再次完成OAuth并进入工作区。
- 回调页按错误码显示统一文案，不展示提供商诊断。
- Staging GitHub完成授权；账号关联失败，未交换新会话。

## 原代码与已执行验证

- `AuthForm` 保留原登录卡片、邮箱注册和 OTP。
- Google/GitHub 只调用 `shared/supabase/auth.ts`。
- 两者共用 `/auth/callback`，回调文案不绑定提供商。
- 桌面继续经系统浏览器授权，白名单仅增 GitHub。
- GitHub 图形来自官方 Octicons，MIT 许可随 public 分发。
- 两图标同为20px；桌面按钮44px，手机按钮48px。
- 390px手机视口无横向溢出，桌面与手机已截图检查。
- 49项前端定向测试通过，5项桌面测试通过。
- TypeScript检查、改动文件lint与Vite生产构建通过。
- 生产Google真实登录完成，已交换PKCE并进入工作区。
- 修改后的本地Staging同样完成Google真实登录。
- Staging既有邮箱账号的身份含Google，JWT认证方法为`oauth`。
- 桌面只完成策略/回调测试，未执行安装包真实OAuth验收。

官方配置依据：[Supabase GitHub 登录](https://supabase.com/docs/guides/auth/social-login/auth-github)。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
