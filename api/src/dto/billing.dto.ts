/**
 * [INPUT]: 依赖 zod 的枚举、UUID、日期与严格对象校验
 * [OUTPUT]: 对外提供只读订阅行、套餐/周期 checkout 与只含 pack_id 的积分 checkout 校验
 * [POS]: DTO 层隔离客户端选购意图与可信订阅事实，拒绝金额、身份、回跳地址和状态注入
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
}).strict();

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const createCreditCheckoutSchema = z.object({
  pack_id: z.enum(["credits_500", "credits_1000", "credits_2000", "credits_5000", "credits_8000", "credits_10000"]),
}).strict();

export type CreateCreditCheckoutInput = z.infer<typeof createCreditCheckoutSchema>;
