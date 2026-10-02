/**
 * [INPUT]: 依赖本目录 supabase client 的 Auth API，依赖浏览器 origin 或可选桌面 bridge 生成 OAuth 回调，桌面授权在系统浏览器打开
 * [OUTPUT]: 对外提供邮箱密码登录/注册、邮箱验证码、OAuth、当前 access token 与仅展示的注册时间读取、退出登录与错误文案
 * [POS]: app/src/shared/supabase 的纯认证服务层，隔离 SDK/会话细节并向统一 API 中枢提供请求期 token，不承载业务资料读写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { supabase } from "./client";
import type {} from "../desktop/bridge";

export type PasswordAuthOutcome = "authenticated" | "verification-required";

const authErrorMessages: Record<string, string> = {
  email_address_invalid: "邮箱地址格式不正确。",
  email_exists: "该邮箱已注册，请直接登录。",
  email_not_confirmed: "请先完成邮箱验证。",
  invalid_credentials: "邮箱或密码不正确。",
  oauth_provider_not_supported: "Google 登录尚未在 Supabase 后台启用。",
  otp_disabled: "邮箱验证码登录尚未在 Supabase 后台启用。",
  otp_expired: "验证码无效或已过期，请重新获取。",
  over_email_send_rate_limit: "发送过于频繁，请稍后再试。",
  signup_disabled: "当前项目暂未开放新用户注册。",
  user_already_exists: "该邮箱已注册，请直接登录。",
  weak_password: "密码强度不足，请换一个更安全的密码。",
};

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAuthErrorMessage(error: unknown) {
  const errorCode = getErrorCode(error);

  if (errorCode && authErrorMessages[errorCode]) {
    return authErrorMessages[errorCode];
  }

  return "认证服务暂时不可用，请稍后再试。";
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<PasswordAuthOutcome> {
  const normalizedEmail = normalizeEmail(email);
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (!signInError && signInData.session) {
    return "authenticated";
  }

  if (getErrorCode(signInError) === "email_not_confirmed") {
    const { error: resendError } = await supabase.auth.resend({
      email: normalizedEmail,
      type: "signup",
    });

    if (resendError && getErrorCode(resendError) !== "over_email_send_rate_limit") {
      throw resendError;
    }

    return "verification-required";
  }

  if (signInError) {
    throw signInError;
  }

  throw new Error("登录成功但未建立会话。请检查 Supabase Auth 配置。");
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<PasswordAuthOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    throw error;
  }

  return data.session ? "authenticated" : "verification-required";
}

export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type: "email",
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("邮箱验证码校验成功但未建立会话。请检查 Supabase Auth 配置。");
  }
}

export async function resendSignupOtp(email: string) {
  const { error } = await supabase.auth.resend({
    email: normalizeEmail(email),
    type: "signup",
  });

  if (error) {
    throw error;
  }
}

export async function signInWithGoogle() {
  const desktop = window.foluneDesktop;
  const redirectTo = desktop ? await desktop.prepareOAuth()
    : new URL("/auth/callback", window.location.origin).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: Boolean(desktop),
    },
  });

  if (error) {
    throw error;
  }
  if (desktop && data.url) await desktop.openOAuth(data.url);
}

export async function completeOAuthSignIn(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }
}

export async function getAuthenticatedAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  return data.session.access_token;
}

// ---- 仅供账户资料展示，不作为身份校验或权限判定 ----
export async function getAuthenticatedCreatedAt(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  const createdAt = data.session?.user.created_at;
  if (error || !createdAt || !Number.isFinite(Date.parse(createdAt))) return null;
  return createdAt;
}

export async function signOutAuthenticatedUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
