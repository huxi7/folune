/**
 * [INPUT]: 依赖 Hono、严格输入、认证与支付 service
 * [OUTPUT]: 注册两类结账、本人订单、验签回调、调度和管理员审计接口
 * [POS]: HTTP 适配层；公开回调由签名认证、调度由独立密钥认证，管理员由可信用户 UUID 授权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";
import { env } from "../config/env.ts";
import { HttpError } from "../common/http-error.ts";
import { paymentService, requireInternalSecret } from "../service/payment.service.ts";
import { Hono } from "hono";
import { ok } from "../common/response.ts";
import { createCheckoutSchema, createCreditCheckoutSchema } from "../dto/billing.dto.ts";
import { authService } from "../service/auth.service.ts";
import { billingService } from "../service/billing.service.ts";
import { parseJsonBody, readAccessToken, parseRouteParams } from "./request.ts";

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

// ---- 支付通知与后台对账：独立服务身份，不读取用户会话 ----
billingRouter.post('/webhooks/nowpayments', async c => {
  const raw=await c.req.text();
  if (Buffer.byteLength(raw)>65_536) throw new HttpError(413,'PAYMENT_BODY_TOO_LARGE','支付通知过大。');
  await paymentService.ipn(raw,c.req.header('x-nowpayments-sig'));
  return ok(c,{received:true});
});
billingRouter.post('/internal/reconcile',async c=>{
  requireInternalSecret(c.req.header('X-Folune-Reconcile-Key'),env.PAYMENT_RECONCILE_SECRET);
  const results=await paymentService.reconcileDue();
  if(results.some(result=>'error' in result)) throw new HttpError(503,'PAYMENT_RECONCILE_INCOMPLETE','部分订单对账失败，将自动重试。',results);
  return ok(c,results);
});
billingRouter.get('/orders',async c=>{
  const user=await authService.authenticate(readAccessToken(c));
  return ok(c,await paymentService.list(user.id));
});
billingRouter.get('/orders/:id',async c=>{
  const user=await authService.authenticate(readAccessToken(c));
  const {id}=parseRouteParams(z.object({id:z.uuid()}),c.req.param());
  return ok(c,await paymentService.get(id,user.id));
});
billingRouter.post('/orders/:id/refresh',async c=>{
  const user=await authService.authenticate(readAccessToken(c));
  const {id}=parseRouteParams(z.object({id:z.uuid()}),c.req.param());
  return ok(c,await paymentService.refresh(id,user.id));
});
billingRouter.get('/admin/orders',async c=>{
  const user=await authService.authenticate(readAccessToken(c));paymentService.requireAdmin(user.id);
  return ok(c,await paymentService.adminOrders());
});
billingRouter.get('/admin/orders/:id/events',async c=>{
  const user=await authService.authenticate(readAccessToken(c));paymentService.requireAdmin(user.id);
  const {id}=parseRouteParams(z.object({id:z.uuid()}),c.req.param());
  return ok(c,await paymentService.adminEvents(id));
});
billingRouter.post('/admin/orders/:id/refresh',async c=>{
  const user=await authService.authenticate(readAccessToken(c));paymentService.requireAdmin(user.id);
  const {id}=parseRouteParams(z.object({id:z.uuid()}),c.req.param());
  const input=await parseJsonBody(c,z.object({payment_id:z.string().regex(/^\d{1,30}$/).optional()}).strict(),"Invalid payment reference");
  return ok(c,await paymentService.adminRefresh(id,input.payment_id));
});

billingRouter.get('/admin/events',async c=>{
  const user=await authService.authenticate(readAccessToken(c));paymentService.requireAdmin(user.id);
  return ok(c,await paymentService.adminEvents());
});
