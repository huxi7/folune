/**
 * [INPUT]: 依赖 Hono、统一响应/输入 helper、authService 与 billingService
 * [OUTPUT]: 对外提供公开套餐/积分包目录、JWT 账户概览及订阅/积分 checkout
 * [POS]: router 层订阅 HTTP 适配器；严格验证选购意图并在调用支付适配前认证，所有个人响应禁止共享缓存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Hono } from "hono";
import { ok } from "../common/response.ts";
import { createCheckoutSchema, createCreditCheckoutSchema } from "../dto/billing.dto.ts";
import { authService } from "../service/auth.service.ts";
import { billingService } from "../service/billing.service.ts";
import { parseJsonBody, readAccessToken } from "./request.ts";

export const billingRouter = new Hono();

billingRouter.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

billingRouter.get("/plans", c => ok(c, billingService.getCatalog()));
billingRouter.get("/credits/packs", c => ok(c, billingService.getCreditPacks()));

billingRouter.get("/overview", async c => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  return ok(c, await billingService.getOverview(authUser, accessToken));
});

billingRouter.post("/checkout", async c => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  const input = await parseJsonBody(c, createCheckoutSchema, "Invalid checkout data");
  return ok(c, await billingService.createCheckout(authUser, input));
});

billingRouter.post("/credits/checkout", async c => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  const input = await parseJsonBody(c, createCreditCheckoutSchema, "Invalid credit checkout data");
  return ok(c, await billingService.createCreditCheckout(authUser, input));
});
