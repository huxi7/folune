/**
 * [INPUT]: 依赖 github 适配器验证的主邮箱与稳定用户 ID
 * [OUTPUT]: 提供 Supabase Custom OAuth2 标准 userinfo，只声明一个已验证主邮箱
 * [POS]: 认证资料转换边界；Supabase 继续独占会话签发和账号关联，不迁移任何业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getVerifiedGitHubPrimaryIdentity } from "../lib/github.ts";

export async function getGitHubUserInfo(accessToken: string) {
  const { user, email } = await getVerifiedGitHubPrimaryIdentity(accessToken);
  return {
    sub: String(user.id), email, email_verified: true,
    preferred_username: user.login, name: user.name ?? user.login,
    picture: user.avatar_url, avatar_url: user.avatar_url,
    full_name: user.name ?? user.login, user_name: user.login,
  };
}
