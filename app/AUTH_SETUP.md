# Supabase Auth 后台配置

前端已经使用 `@supabase/supabase-js@2.110.2`、Publishable key 与 PKCE 流程完成接入。以下后台配置必须与代码保持一致。

## 1. 邮箱密码与 6 位验证码

在 Supabase Dashboard 中打开 `Authentication > Sign In / Providers > Email`：

- 开启 Email provider。
- 保持 Confirm email 开启，未验证邮箱不得建立正式会话。
- 保持 Secure email change 开启。
- 根据产品策略设置最小密码长度；前端只做 6 位基础校验，最终规则以 Auth 服务端为准。

在 `Authentication > Email Templates > Confirm signup` 中让正文包含 `{{ .Token }}`，例如：

```html
<h2>验证你的 Folune 账号</h2>
<p>你的 6 位验证码是：</p>
<p>{{ .Token }}</p>
```

代码使用 `verifyOtp({ email, token, type: "email" })` 校验验证码；这是当前 SDK 推荐类型。注册邮件重发使用 `resend({ type: "signup" })`。
前端登录与注册分别调用 `signInWithPassword` 和 `signUp`；登录失败不会自动创建新账号。

注意：自 2026-06-03 起，新建 Free 项目若使用 Supabase 默认 SMTP，不能自定义 Auth 邮件模板。要发送 6 位验证码，需配置自定义 SMTP 或升级 Pro；已有旧项目模板不受影响。

## 2. URL Configuration

在 `Authentication > URL Configuration` 中配置：

- Site URL：本地开发可用 `http://localhost:10000`，生产环境改为正式域名。
- Redirect URLs：加入 `http://localhost:10000/auth/callback`。
- 上线时再加入 `https://你的正式域名/auth/callback`，不要使用无边界通配符。

## 3. Google OAuth

在 Google Cloud Console 创建 Web OAuth Client，并把下面地址加入 Google 的 Authorized redirect URIs：

```text
https://buauzrzxifgdacntisfq.supabase.co/auth/v1/callback
```

然后在 Supabase `Authentication > Sign In / Providers > Google` 中填入 Google Client ID 与 Client Secret 并启用 provider。

用户授权完成后，Supabase 会回到前端 `/auth/callback`；前端使用 PKCE `exchangeCodeForSession` 建立会话并进入 `/app`。

### 公开法律页面与 Google 品牌验证

当前前端已提供独立公开 `/privacy` 与 `/terms`，二者复用博客的 PublicArticle 阅读模板和 MarketingLayout，但不属于博客内容集合。登录页和首页 Footer 均通过 SPA 链接进入；直达不要求登录。

正式部署到 `https://folune.huxi7.com` 后，在 Google Auth Platform 的 Branding 页面填写：

| 字段 | 值 |
| --- | --- |
| App name | Folune |
| Application home page | `https://folune.huxi7.com/` |
| Application privacy policy link | `https://folune.huxi7.com/privacy` |
| Application terms of service link | `https://folune.huxi7.com/terms` |
| 公开运营者 | huxi（Folune 独立开发者） |
| 政策联系邮箱 | `oxygen777@2925.com` |

Google 的 User support email 必须从当前项目可选且由运营者控制的邮箱中选择；不保证任意外部邮箱均可直接填入。Developer contact information 使用实际可收信的地址，并保持与运营者身份一致。`privacy@huxi7.com` 尚未配置，不应写成已经可用的政策联系渠道；当前域名 MX 指向 Google，不能为了转发而直接替换既有邮件路由。

Google 核查的是披露与实际行为的一致性，不以字数判断政策是否合格。当前 `signInWithGoogle` 不额外请求业务权限；根据 Supabase 官方文档，基础登录使用 `openid`、`userinfo.email` 和 `userinfo.profile`。提交前必须核对 Cloud Console Data Access 和实际授权请求，移除没有产品用途的权限；若增加敏感或受限权限，需要相应额外验证，不能仅靠现有政策覆盖。

上线与提交前仍需验证：

- 在 Google Search Console 验证 `huxi7.com` 的所有权，并按 Google 要求登记首页、政策、客户端 origin/回调涉及的授权域名。使用 Supabase 默认认证域时，应核对实际回调域的配置要求，不能声称拥有 `supabase.co`。
- 在 Supabase 中设置正式 Site URL 和精确的 `https://folune.huxi7.com/auth/callback` allow list；Google 客户端的 redirect URI 指向实际 Supabase 认证回调，二者不能混填。
- 部署服务器对 `/privacy`、`/terms` 等 SPA 路径返回应用入口；新窗口直接打开、刷新、无会话访问都应成功，不得被 `/app` 登录守卫拦截。
- 核实正式 HTTPS 页面可访问、首页含法律链接、隐私正文可见，且 Google Branding 所填地址与页面身份一致。本次本地代码交付不代表已部署、已提交或已通过 Google 验证。
- 复核实际托管区域、供应商合同和模型数据保留/训练安排，按事实维护政策。当前没有承诺模型零保留、统一自动过期清理或端到端加密；人工注销请求需要运营者真正响应和执行。

官方依据（2026-09-25 查阅）：[Google 品牌验证](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)、[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)、[Supabase Google 登录](https://supabase.com/docs/guides/auth/social-login/auth-google)。

## 4. Cloudflare Turnstile（尚未启用）

登录页部署后不会自动出现人机验证。启用需要前端组件、站点密钥和 Supabase Auth 后台配置一起完成：

- 在 Cloudflare Turnstile 创建站点并绑定正式域名，选择 Managed 模式；是否要求点击由 Turnstile 判断，不能保证每次都显示复选框。
- 公开 Site Key 交给前端组件；Secret Key 只配置在 Supabase Auth 的 CAPTCHA Protection 中，provider 选择 Turnstile，不能放入浏览器环境变量。
- 前端收到验证 token 后，随邮箱登录、注册及未来的密码重置请求传入 `options.captchaToken`；处理验证失败、过期、请求后重置与重发验证码的流程，再开启服务端强制校验。
- 当前只保留「忘记密码？」的无动作按钮，未渲染模拟验证框，未启用 Turnstile 或修改线上认证配置。

配置依据：[Supabase CAPTCHA 文档](https://supabase.com/docs/guides/auth/auth-captcha)与[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)。
