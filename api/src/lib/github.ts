/**
 * [INPUT]: 依赖请求期 GitHub OAuth token、固定 GitHub API 和 zod 响应校验
 * [OUTPUT]: 读取真实 GitHub 身份与已验证主邮箱；分页查找，不采用公开邮箱或备用邮箱回退
 * [POS]: 只读身份适配器；token 不记录、不缓存、不持久化，不读取 Folune 账号或业务表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";
import { HttpError } from "../common/http-error.ts";

const GITHUB_API = "https://api.github.com";
const GITHUB_REQUEST_TIMEOUT_MS = 6_000;
const GITHUB_PAGE_SIZE = 100;
const userSchema = z.object({
  id: z.number().int().positive().safe(), login: z.string().min(1),
  name: z.string().nullable(), avatar_url: z.url(),
});
const emailsSchema = z.array(z.object({ email: z.email(), primary: z.boolean(), verified: z.boolean() }));

async function githubGet(path: string, accessToken: string) {
  try {
    const response = await fetch(`${GITHUB_API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Folune-Auth" },
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS), redirect: "error",
    });
    if (!response.ok) throw new HttpError(response.status === 401 ? 401 : 502,
      "GITHUB_IDENTITY_UNAVAILABLE", "无法验证 GitHub 身份，请重新登录。");
    return await response.json();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "GITHUB_IDENTITY_UNAVAILABLE", "无法验证 GitHub 身份，请重新登录。");
  }
}

export async function getVerifiedGitHubPrimaryIdentity(accessToken: string) {
  const parsedUser = userSchema.safeParse(await githubGet("/user", accessToken));
  if (!parsedUser.success) throw new HttpError(502, "GITHUB_IDENTITY_INVALID", "GitHub 身份资料无效。");
  for (let page = 1; ; page++) {
    const parsed = emailsSchema.safeParse(await githubGet(`/user/emails?per_page=${GITHUB_PAGE_SIZE}&page=${page}`, accessToken));
    if (!parsed.success) throw new HttpError(502, "GITHUB_IDENTITY_INVALID", "GitHub 邮箱资料无效。");
    const primary = parsed.data.filter(email => email.primary);
    if (primary.length > 1) throw new HttpError(502, "GITHUB_IDENTITY_INVALID", "GitHub 主邮箱资料无效。");
    if (primary[0]) {
      if (!primary[0].verified) throw new HttpError(403, "GITHUB_PRIMARY_EMAIL_UNVERIFIED", "请先在 GitHub 验证主邮箱。");
      return { user: parsedUser.data, email: primary[0].email.trim().toLowerCase() };
    }
    if (parsed.data.length < GITHUB_PAGE_SIZE) break;
  }
  throw new HttpError(403, "GITHUB_PRIMARY_EMAIL_MISSING", "请先在 GitHub 设置并验证主邮箱。");
}
