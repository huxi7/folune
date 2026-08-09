/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型
 * [OUTPUT]: 对外提供经过 Supabase Auth 服务验证的 AuthUser 领域模型
 * [POS]: model 层可信用户身份，只能由 auth service 建立并供业务 service 授权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface AuthUser {
  id: string;
  email: string | null;
  userMetadata: Readonly<Record<string, unknown>>;
}
