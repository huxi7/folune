/**
 * [INPUT]: 依赖 zod 的白名单/UUID/日期校验
 * [OUTPUT]: 校验订阅读取和订阅/积分结账意图及可选幂等键
 * [POS]: 严格拒绝客户端价格、用户归属、支付状态与回跳来源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";

const paidPlanIdSchema = z.enum(["starter", "pro", "studio"]);
const billingIntervalSchema = z.enum(["monthly", "yearly"]);
const timestampSchema = z.iso.datetime({ offset: true });

export const subscriptionRowsSchema = z.array(z.object({
  user_id: z.uuid(),
  plan_id: paidPlanIdSchema,
  status: z.enum(["active", "past_due", "canceled", "expired"]),
  billing_interval: billingIntervalSchema,
  current_period_start: timestampSchema,
  current_period_end: timestampSchema,
  cancel_at_period_end: z.boolean(),
}).refine(row => Date.parse(row.current_period_end) > Date.parse(row.current_period_start)));

export const createCheckoutSchema = z.object({
  plan_id: paidPlanIdSchema,
  billing_interval: billingIntervalSchema,
  idempotency_key: z.uuid().optional(),
}).strict();

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const createCreditCheckoutSchema = z.object({
  idempotency_key: z.uuid().optional(),
  pack_id: z.enum(["credits_500", "credits_1000", "credits_2000", "credits_5000", "credits_8000", "credits_10000"]),
}).strict();

export type CreateCreditCheckoutInput = z.infer<typeof createCreditCheckoutSchema>;
