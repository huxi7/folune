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
<h2>验证你的 SuperNote 账号</h2>
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
