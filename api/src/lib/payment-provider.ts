/**
 * [INPUT]: 依赖 PaymentProvider 契约，不读取用户 JWT 或引入支付 SDK
 * [OUTPUT]: 对外提供尚未接入网关的订阅与积分 paymentProvider，两条入口均明确不可支付
 * [POS]: lib 层未来支付服务的唯一适配接缝；未签约网关时不伪造 checkout URL、订单或付款成功，订阅激活必须另经可信回调落账
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { PaymentProvider } from "../model/billing.model.ts";

export const paymentProvider: PaymentProvider = Object.freeze({
  availability: Object.freeze({ available: false, provider: null }),
  async createCheckout() {
    return {
      status: "unavailable" as const,
      code: "PAYMENT_NOT_CONFIGURED" as const,
      message: "在线订阅即将开放",
      checkout_url: null,
    };
  },
  async createCreditCheckout() {
    return {
      status: "unavailable" as const,
      code: "PAYMENT_NOT_CONFIGURED" as const,
      message: "积分购买即将开放",
      checkout_url: null,
    };
  },
});
