/**
 * [INPUT]: 依赖 zod 的对象与 strict schema 能力
 * [OUTPUT]: 对外提供 profileRowSchema、profileRowsSchema、patchProfileSchema 与 infer 类型
 * [POS]: dto 层五字段 profiles PostgREST 响应和 username/bio PATCH 白名单；username 是非空展示名称，avatar_url 只由头像用例更新
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const profileRowSchema = z.object({
  id: z.uuid(),
  email: z.email().nullable(),
  username: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
});

export const profileRowsSchema = z.array(profileRowSchema);

export const patchProfileSchema = z
  .object({
    username: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
  });

export type ProfileRow = z.infer<typeof profileRowSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;
