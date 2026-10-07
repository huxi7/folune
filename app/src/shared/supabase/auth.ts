/**
 * [INPUT]: 依赖本目录 supabase client 的 Auth API，依赖浏览器 origin 或可选桌面 bridge 生成 OAuth 回调，桌面授权在系统浏览器打开
 * [OUTPUT]: 提供邮箱认证、Google/GitHub OAuth、经服务端验证的 GitHub 账号选择与绑定、会话读取和统一错误文案
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
  access_denied: "授权未完成，请重新登录或选择其他方式。",
  oauth_provider_not_supported: "此登录方式暂未启用，请选择其他方式。",
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

async function getOAuthOptions() {
  const desktop = window.foluneDesktop;
  const redirectTo = desktop ? await desktop.prepareOAuth()
    : new URL("/auth/callback", window.location.origin).toString();
  return { redirectTo, skipBrowserRedirect: Boolean(desktop) };
}

async function signInWithOAuth(provider: "google" | "github") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: await getOAuthOptions(),
  });

  if (error) {
    throw error;
  }
  if (window.foluneDesktop && data.url) await window.foluneDesktop.openOAuth(data.url);
}

// ---- 只保存本标签页的短期意图，不保存邮箱、凭据或候选账号 ----
const GITHUB_LINK_INTENT_KEY = "folune.github-link-intent";
const GITHUB_LINK_INTENT_TTL = 10 * 60 * 1000;
type GitHubLinkIntent = { phase: "select" | "link"; expiresAt: number; userId?: string };

export function clearGitHubLinkIntent() {
  window.sessionStorage.removeItem(GITHUB_LINK_INTENT_KEY);
}

export function getGitHubLinkIntent(): GitHubLinkIntent | null {
  try {
    const raw = window.sessionStorage.getItem(GITHUB_LINK_INTENT_KEY);
    const intent = raw ? JSON.parse(raw) as GitHubLinkIntent : null;
    if (intent && (intent.phase === "select" || intent.phase === "link")
      && Number.isFinite(intent.expiresAt) && intent.expiresAt > Date.now()
      && (intent.phase !== "link" || typeof intent.userId === "string")) return intent;
  } catch { /* 损坏的本地意图按过期取消。 */ }
  clearGitHubLinkIntent();
  return null;
}

export function beginGitHubAccountSelection() {
  window.sessionStorage.setItem(GITHUB_LINK_INTENT_KEY, JSON.stringify({
    phase: "select", expiresAt: Date.now() + GITHUB_LINK_INTENT_TTL,
  }));
}

export function isOAuthAccountConflict(params: URLSearchParams) {
  return params.get("error") === "server_error"
    && (params.get("error_description") ?? "").startsWith(
      "Multiple accounts with the same email address in the same linking domain detected:",
    );
}

export async function getGitHubLinkAccount() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.email) throw new Error("缺少已验证的登录账号。");
  return { id: data.user.id, email: data.user.email,
    hasGitHub: data.user.identities?.some(identity => identity.provider === "github") ?? false };
}

export async function linkGitHubIdentity(expectedUserId: string) {
  const account = await getGitHubLinkAccount();
  if (account.id !== expectedUserId) throw new Error("登录账号已切换，请重新选择。");
  window.sessionStorage.setItem(GITHUB_LINK_INTENT_KEY, JSON.stringify({
    phase: "link", userId: account.id, expiresAt: Date.now() + GITHUB_LINK_INTENT_TTL,
  }));
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "github", options: await getOAuthOptions(),
    });
    if (error) throw error;
    if (window.foluneDesktop && data.url) await window.foluneDesktop.openOAuth(data.url);
  } catch (error) { clearGitHubLinkIntent(); throw error; }
}

export async function verifyGitHubLinkResult(expectedUserId: string) {
  const account = await getGitHubLinkAccount();
  if (account.id !== expectedUserId || !account.hasGitHub) throw new Error("GitHub 绑定未完成。");
  clearGitHubLinkIntent();
}

export function signInWithGoogle() {
  return signInWithOAuth("google");
}

export function signInWithGitHub() {
  return signInWithOAuth("github");
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
