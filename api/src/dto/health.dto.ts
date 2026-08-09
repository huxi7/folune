/**
 * [INPUT]: 依赖 zod 的对象与字面量 schema 能力
 * [OUTPUT]: 对外提供 healthDataSchema 与其 infer 得到的 HealthData 类型
 * [POS]: dto 层的健康检查响应边界，不依赖 Hono
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const healthDataSchema = z.object({
  status: z.literal("healthy"),
});

export type HealthData = z.infer<typeof healthDataSchema>;
