/**
 * [INPUT]: 依赖调用方提供的当前会话 token 读取器与可选的显式 token 快照
 * [OUTPUT]: 对外提供 resolveApiAccessToken 纯策略，优先当前会话并仅以显式快照兜底
 * [POS]: shared/api 的长会话鉴权决策层；不初始化 Supabase 或网络，使刷新优先级可被独立验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type AccessTokenProvider = () => Promise<string | null>;

/**
 * 路由 loader 给出的 token 只是进入工作区那一刻的快照。长会话里 Supabase 会自动
 * 刷新 session，如果继续优先使用旧快照，只有尚未缓存、真正发请求的资源会突然 401。
 */
export const resolveApiAccessToken = async (
  explicitAccessToken: string | undefined,
  readCurrentAccessToken: AccessTokenProvider,
): Promise<string | null> =>
  await readCurrentAccessToken() ?? explicitAccessToken ?? null;
