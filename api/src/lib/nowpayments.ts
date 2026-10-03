/**
 * [INPUT]: 依赖统一服务端配置、无损 JSON、HMAC 与 HttpError
 * [OUTPUT]: 提供普通汇率 Invoice、商户预检、按发票查单、异常入金识别和验签
 * [POS]: NOWPayments 唯一网络适配器；固定主机、有限超时、不重放创建请求、不向外暴露供应商错误/凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  parse,
  stringify,
  isLosslessNumber,
  LosslessNumber,
} from "lossless-json";
import { HttpError } from "../common/http-error.ts";
import type { Env } from "../config/env.ts";
import type {
  PaymentEnvironment,
  PaymentOrder,
  VerifiedPayment,
} from "../model/payment.model.ts";
import { centsToUsd, decimalUnits, usdCents } from "./payment-amount.ts";

type Config = Pick<
  Env,
  "NOWPAYMENTS_ENV" | "NOWPAYMENTS_API_KEY" | "NOWPAYMENTS_IPN_SECRET"
> &
  Partial<
    Pick<
      Env,
      | "NOWPAYMENTS_EMAIL"
      | "NOWPAYMENTS_PASSWORD"
      | "PAYMENT_APP_ORIGIN"
      | "PAYMENT_API_ORIGIN"
    >
  >;
const API_ORIGINS = {
  sandbox: "https://api-sandbox.nowpayments.io",
  production: "https://api.nowpayments.io",
} as const;
const invalid = () =>
  new HttpError(502, "NOWPAYMENTS_DATA_INVALID", "支付平台响应无法验证。");
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function scalar(value: unknown): string {
  if (typeof value === "string") return value;
  if (isLosslessNumber(value)) return value.value;
  throw invalid();
}
function currency(value: unknown): string {
  const code = scalar(value);
  if (!/^[a-z0-9]{1,32}$/i.test(code)) throw invalid();
  return code.toLowerCase();
}

export function requireOriginalPayment(row: Record<string, unknown>): void {
  // 2s93JusNJt：重复入金和错币入金即使 finished，也不能据此自动交付。
  const origin = row["origin_type"];
  if (
    row["parent_payment_id"] != null ||
    (origin != null && typeof origin !== "string") ||
    (typeof origin === "string" && /REPEAT|WRONG/i.test(origin))
  ) {
    throw new HttpError(
      409,
      "PAYMENT_DEPOSIT_REQUIRES_REVIEW",
      "重复入金或错币付款需要人工核查。",
    );
  }
}
export function providerId(value: unknown): string {
  const id = scalar(value);
  if (!/^\d{1,30}$/.test(id)) throw invalid();
  return id;
}
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object" && !isLosslessNumber(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sort((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
export function verifyNowpaymentsIpn(
  raw: string,
  signature: string | undefined,
  secret: string | undefined,
): Record<string, unknown> {
  if (!secret)
    throw new HttpError(503, "PAYMENT_NOT_CONFIGURED", "支付回调尚未配置。");
  if (!signature || !/^[a-fA-F0-9]{128}$/.test(signature))
    throw new HttpError(401, "PAYMENT_SIGNATURE_INVALID", "支付签名无效。");
  let body: Record<string, unknown>;
  try {
    body = object(parse(raw));
  } catch {
    throw new HttpError(400, "PAYMENT_BODY_INVALID", "支付通知格式无效。");
  }
  // 官方签名示例对 JSON 解码后排序再编码；金额本身另用无损解析，不从签名对象取值。
  const digest = createHmac("sha512", secret)
    .update(JSON.stringify(sort(JSON.parse(raw))))
    .digest();
  if (!timingSafeEqual(digest, Buffer.from(signature, "hex")))
    throw new HttpError(401, "PAYMENT_SIGNATURE_INVALID", "支付签名无效。");
  return body;
}
export function validateCheckoutUrl(
  value: string,
  environment: PaymentEnvironment,
  invoiceId: string,
): string {
  const url = new URL(value);
  const hosts =
    environment === "production"
      ? ["nowpayments.io"]
      : ["sandbox.nowpayments.io", "account-sandbox.nowpayments.io"];
  if (
    url.protocol !== "https:" ||
    !hosts.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname.replace(/\/$/, "") !== "/payment" ||
    url.searchParams.get("iid") !== invoiceId
  )
    throw invalid();
  return url.href;
}
async function request(
  config: Config,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  try {
    const response = await fetch(
      `${API_ORIGINS[config.NOWPAYMENTS_ENV]}/v1/${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
        headers: {
          ...(path === "status"
            ? {}
            : { "x-api-key": config.NOWPAYMENTS_API_KEY ?? "" }),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: stringify(body)! }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(
        502,
        [401, 403].includes(response.status)
          ? "NOWPAYMENTS_AUTH_REJECTED"
          : "NOWPAYMENTS_UNAVAILABLE",
        "支付平台请求失败，请核对环境和凭据或稍后重试。",
      );
    }
    return parse(await response.text());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "NOWPAYMENTS_UNAVAILABLE",
      "支付平台请求失败，请稍后重试。",
    );
  }
}
function payment(value: unknown): VerifiedPayment {
  const row = object(value);
  requireOriginalPayment(row);
  const result = {
    payment_id: providerId(row["payment_id"]),
    invoice_id: providerId(row["invoice_id"]),
    order_id: scalar(row["order_id"]),
    payment_status: scalar(row["payment_status"]),
    price_amount: scalar(row["price_amount"]),
    price_currency: currency(row["price_currency"]),
    pay_amount: scalar(row["pay_amount"]),
    actually_paid: scalar(row["actually_paid"]),
    pay_currency: currency(row["pay_currency"]),
    updated_at: scalar(row["updated_at"]),
  };
  if (
    !/^[0-9a-f-]{36}$/i.test(result.order_id) ||
    !/^[a-z_]{1,30}$/.test(result.payment_status) ||
    !Number.isFinite(Date.parse(result.updated_at))
  )
    throw invalid();
  try {
    usdCents(result.price_amount);
    decimalUnits(result.pay_amount);
    decimalUnits(result.actually_paid);
  } catch {
    throw invalid();
  }
  return result;
}
async function merchantToken(config: Config): Promise<string> {
  if (!config.NOWPAYMENTS_EMAIL || !config.NOWPAYMENTS_PASSWORD)
    throw new HttpError(
      503,
      "PAYMENT_RECONCILE_NOT_CONFIGURED",
      "后台对账凭据尚未配置。",
    );
  return scalar(
    object(
      await request(config, "auth", {
        email: config.NOWPAYMENTS_EMAIL,
        password: config.NOWPAYMENTS_PASSWORD,
      }),
    )["token"],
  );
}
export function nowpaymentsClient(config: Config) {
  let merchantSession: { token: string; expiresAt: number } | undefined;
  let authRequest: Promise<string> | undefined;
  const getMerchantToken = (): Promise<string> => {
    if (merchantSession && Date.now() < merchantSession.expiresAt)
      return Promise.resolve(merchantSession.token);
    if (authRequest) return authRequest;
    // 官方令牌有效期 5 分钟；只在本进程保留 4 分钟，多个订单共用在途登录。
    const issuedAt = Date.now();
    authRequest = merchantToken(config)
      .then((token) => {
        merchantSession = { token, expiresAt: issuedAt + 240_000 };
        return token;
      })
      .finally(() => {
        authRequest = undefined;
      });
    return authRequest;
  };
  return {
    async createInvoice(order: PaymentOrder) {
      const returnUrl = `${config.PAYMENT_APP_ORIGIN}/app/subscription?order=${order.id}`;
      const row = object(
        await request(config, "invoice", {
          price_amount: new LosslessNumber(centsToUsd(order.amount_cents)),
          price_currency: "usd",
          order_id: order.id,
          order_description: `Folune ${order.sku}${order.billing_interval ? ` ${order.billing_interval}` : ""}`,
          ipn_callback_url: `${config.PAYMENT_API_ORIGIN}/billing/webhooks/nowpayments`,
          success_url: returnUrl,
          cancel_url: returnUrl,
          partially_paid_url: returnUrl,
          // 固定汇率属于换汇产品，会抬高最低付款额；小额商品使用普通报价。
          is_fixed_rate: false,
          is_fee_paid_by_user: false,
        }),
      );
      const invoiceId = providerId(row["id"]);
      if (
        scalar(row["order_id"]) !== order.id ||
        currency(row["price_currency"]) !== "usd" ||
        usdCents(scalar(row["price_amount"])) !== order.amount_cents
      )
        throw invalid();
      return {
        invoice_id: invoiceId,
        checkout_url: validateCheckoutUrl(
          scalar(row["invoice_url"]),
          config.NOWPAYMENTS_ENV,
          invoiceId,
        ),
      };
    },
    async getPayment(id: string) {
      if (!/^\d{1,30}$/.test(id)) throw invalid();
      const result = payment(await request(config, `payment/${id}`));
      if (result.payment_id !== id) throw invalid();
      return result;
    },
    async discoverPayments(order: PaymentOrder) {
      const token = await getMerchantToken();
      const deadline = Date.now() + 60_000;
      const matches: string[] = [];
      // 有发票 ID 时直接按 invoiceId 查；仅创建响应丢失时按时间分页找回内部订单。
      const dateTo = new Date().toISOString();
      for (let page = 0; page < 100; page++) {
        if (Date.now() > deadline)
          throw new HttpError(
            503,
            "PAYMENT_RECONCILE_TIMEOUT",
            "付款发现超时，将稍后重试。",
          );
        const query = new URLSearchParams({
          limit: "500",
          page: String(page),
          sortBy: "created_at",
          orderBy: "asc",
          ...(order.invoice_id
            ? { invoiceId: order.invoice_id }
            : {
                dateFrom: new Date(
                  Date.parse(order.created_at) - 300_000,
                ).toISOString(),
                dateTo,
              }),
        });
        let row: Record<string, unknown>;
        try {
          row = object(
            await request(config, `payment/?${query}`, undefined, token),
          );
        } catch (error) {
          if (
            error instanceof HttpError &&
            error.code === "NOWPAYMENTS_AUTH_REJECTED"
          )
            merchantSession = undefined;
          throw error;
        }
        if (!Array.isArray(row["data"])) throw invalid();
        for (const value of row["data"]) {
          const item = object(value);
          if (item["order_id"] === order.id) {
            requireOriginalPayment(item);
            if (
              order.invoice_id &&
              providerId(item["invoice_id"]) !== order.invoice_id
            )
              throw invalid();
            matches.push(providerId(item["payment_id"]));
          }
        }
        const pages = Number(scalar(row["pagesCount"]));
        if (!Number.isSafeInteger(pages) || pages < 0) throw invalid();
        if (page + 1 >= pages) return [...new Set(matches)];
      }
      throw new HttpError(
        503,
        "PAYMENT_RECONCILE_LIMIT",
        "付款列表超过本次对账上限，需管理员处理。",
      );
    },
  };
}
export async function checkNowpaymentsConnection(config: Config) {
  if (object(await request(config, "status"))["message"] !== "OK")
    throw invalid();
  let currencies: string[] = [];
  if (config.NOWPAYMENTS_API_KEY) {
    const merchant = object(await request(config, "merchant/coins"));
    // 正式接口实测使用 selectedCurrencies；旧版文档/沙箱仍可能返回 currencies。
    const value = Object.hasOwn(merchant, "selectedCurrencies")
      ? merchant["selectedCurrencies"]
      : merchant["currencies"];
    if (
      !Array.isArray(value) ||
      !value.every((x) => typeof x === "string" && /^[a-z0-9]{1,32}$/i.test(x))
    )
      throw invalid();
    currencies = [...new Set(value.map((code) => code.toLowerCase()))];
  }
  let discovery = "missing";
  if (config.NOWPAYMENTS_EMAIL && config.NOWPAYMENTS_PASSWORD) {
    const token = await merchantToken(config);
    const listing = object(
      // 正式接口实测：省略排序可能返回 500；与正式对账请求使用相同排序字段。
      await request(config, "payment/?limit=1&page=0&sortBy=created_at&orderBy=asc", undefined, token),
    );
    if (!Array.isArray(listing["data"])) throw invalid();
    discovery = "accepted";
  }
  return {
    discovery_auth: discovery,
    environment: config.NOWPAYMENTS_ENV,
    api: "reachable" as const,
    api_key: config.NOWPAYMENTS_API_KEY
      ? ("accepted" as const)
      : ("missing" as const),
    ipn_secret: config.NOWPAYMENTS_IPN_SECRET
      ? ("configured_not_verified" as const)
      : ("missing" as const),
    merchant_currencies: currencies,
  };
}
