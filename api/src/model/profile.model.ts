/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型
 * [OUTPUT]: 对外提供精简五字段 Profile 与首次建档 CreateProfileData 领域模型
 * [POS]: model 层的最小用户资料实体，以非空 username 承载单一且非唯一约束的展示名称，并与 public.profiles 五列同构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface CreateProfileData {
  id: string;
  email: string | null;
  username: string;
}
