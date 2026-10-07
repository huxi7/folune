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

## GitHub 主邮箱规则

GitHub 使用 `custom:github` OAuth2 Provider。
授权与换码仍直连 GitHub，并由 Supabase 编排。
UserInfo 指向正式 API 的 `/auth/github/userinfo`。
API 向 GitHub 验证 token、用户 ID 与邮箱列表。
只返回 `primary=true` 且 `verified=true` 的邮箱。
备用邮箱和 GitHub 公开 profile 邮箱不作回退。
主邮箱在后续页时继续分页查找。
缺少或未验证主邮箱时拒绝认证。

Supabase 根据单一主邮箱自动匹配或创建账号。
已绑定的 GitHub 身份继续使用稳定 provider ID。
前端取消账号选择、邮箱重输和手动绑定意图。
不修改既有 Gmail/QQ 账号、笔记、余额或订阅。
Client Secret 仍只在 Supabase；API 不持有 Secret。
API 不保存 GitHub token，不访问业务表。
Google 使用原 Provider 与 PKCE 链路。

当前迁移：先发布 userinfo，再切换前端。
新链路验证后关闭原生 GitHub 与手动绑定开关。
两库分别配置，其他 Auth 字段保持原值。
真实验收与发布版本在完成后补记。

## 本轮验证

- 7项主邮箱HTTP测试、22项前端认证测试、6项桌面测试通过。
- API/前端类型检查、改动文件lint与前端构建通过。
- Production Google再次完成OAuth并进入工作区。
- 回调页按错误码显示统一文案，不展示提供商诊断。
- Staging GitHub已按主邮箱完成PKCE并关联原Gmail账号。
- QQ备用邮箱账号保持原ID，身份仍只有email。
- 本地API watch在切分支时失效，重启后健康，工作区重新进入。

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
