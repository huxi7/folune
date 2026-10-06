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

## 当前阻塞

生成生产 Client Secret 时，GitHub 要求 sudo mode 两步验证码。
该验证须由账号所有者完成；本次没有生成或保存 Secret。
没有修改任何 Supabase Auth 配置。
两库 `/auth/v1/settings` 实测均为 Google 开启、GitHub 关闭。
GitHub 真实登录尚未验证；此状态不代表已接通。
代码只提交至 main，未发布 production。

## 恢复执行边界

本人完成 GitHub 验证后，继续生成两套 Secret。
通过受信任通道直接填入各自 Supabase GitHub Provider。
提交前重读 Auth 配置，排除浏览器密码自动填充。
只修改 `external_github_enabled`、`external_github_client_id`、`external_github_secret`。
保留 Google、SMTP、Site URL 和现有重定向白名单。
保存后核对两库 GitHub 状态和其他字段不变。
分别完成 GitHub 授权、PKCE 交换、工作区进入和退出后重登。
重新验证 Google 登录，再发布 production 并核对部署提交号。

## 代码与已执行验证

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
