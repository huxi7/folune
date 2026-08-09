/**
 * [INPUT]: 依赖 zod 的 UUID、email、record 与对象 schema 能力
 * [OUTPUT]: 对外提供 supabaseAuthUserSchema 与其 infer 得到的 SupabaseAuthUserPayload
 * [POS]: dto 层的 Supabase /auth/v1/user 响应校验边界，不依赖 Hono
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const supabaseAuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email().nullable().optional(),
  user_metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional(),
});

export type SupabaseAuthUserPayload = z.infer<
  typeof supabaseAuthUserSchema
>;
