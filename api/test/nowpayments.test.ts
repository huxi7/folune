/**
 * [INPUT]: 依赖 NOWPayments 只读适配器与受控 fetch 替身
 * [OUTPUT]: 验证沙箱/正式隔离、商户币种字段兼容、凭据边界、显式列表排序、手续费净额隔离与错误净化
 * [POS]: 支付配置阶段的网络边界测试；不替代商户凭据、IPN 或链上支付验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { centsToUsd, usdCents } from "../src/lib/payment-amount.ts";
import type { PaymentOrder } from "../src/model/payment.model.ts";
import {
  checkNowpaymentsConnection,
  nowpaymentsClient,
  verifyNowpaymentsIpn,
  validateCheckoutUrl,
} from "../src/lib/nowpayments.ts";

const originalFetch = globalThis.fetch;
const config = {
  NOWPAYMENTS_ENV: "sandbox" as const,
  NOWPAYMENTS_API_KEY: undefined,
  NOWPAYMENTS_IPN_SECRET: undefined,
};
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("缺少凭据仅检查沙箱公共状态，不请求商户数据，不宣布可收款", async () => {
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls++;
    expect(String(input)).toBe("https://api-sandbox.nowpayments.io/v1/status");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
    return Response.json({ message: "OK" });
  }) as typeof fetch;
  expect(await checkNowpaymentsConnection(config)).toEqual({
    environment: "sandbox",
    api: "reachable",
    api_key: "missing",
    ipn_secret: "missing",
    merchant_currencies: [],
    discovery_auth: "missing",
  });
  expect(calls).toBe(1);
});

test("显式正式环境只以 API Key 读取商户币种，IPN Secret 不出站", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    expect(url.origin).toBe("https://api.nowpayments.io");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(init)).not.toContain("private-ipn-secret");
    if (url.pathname === "/v1/status") return Response.json({ message: "OK" });
    expect(new Headers(init?.headers).get("x-api-key")).toBe("test-api-key");
    return Response.json({ currencies: ["usdttrc20", "btc"] });
  }) as typeof fetch;
  const result = await checkNowpaymentsConnection({
    NOWPAYMENTS_ENV: "production",
    NOWPAYMENTS_API_KEY: "test-api-key",
    NOWPAYMENTS_IPN_SECRET: "private-ipn-secret",
  });
  expect(paths).toEqual(["/v1/status", "/v1/merchant/coins"]);
  expect(result.api_key).toBe("accepted");
  expect(result.ipn_secret).toBe("configured_not_verified");
  expect(result.discovery_auth).toBe("missing");
  expect(JSON.stringify(result)).not.toContain("private-ipn-secret");
  expect(JSON.stringify(result)).not.toContain("test-api-key");
});

test("凭据拒绝保留可操作原因，供应商正文不外泄", async () => {
  globalThis.fetch = (async (input) =>
    String(input).endsWith("/status")
      ? Response.json({ message: "OK" })
      : Response.json(
          { message: "private-api-key-payload" },
          { status: 403 },
        )) as typeof fetch;
  await expect(
    checkNowpaymentsConnection({ ...config, NOWPAYMENTS_API_KEY: "wrong-key" }),
  ).rejects.toMatchObject({ code: "NOWPAYMENTS_AUTH_REJECTED", status: 502 });
});

test("兼容正式接口 selectedCurrencies，空选择不会回退成旧字段币种", async () => {
  for (const selectedCurrencies of [["BTC", "USDTTRC20", "btc"], []]) {
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith("/status")
        ? Response.json({ message: "OK" })
        : Response.json({
            selectedCurrencies,
            currencies: ["eth"],
          })) as typeof fetch;
    const result = await checkNowpaymentsConnection({
      ...config,
      NOWPAYMENTS_API_KEY: "test-key",
    });
    expect(result.api_key).toBe("accepted");
    expect(result.merchant_currencies).toEqual([
      ...new Set(selectedCurrencies.map((code) => code.toLowerCase())),
    ]);
  }
});

test("断网或响应体读取失败统一净化，不传播异常中的密钥", async () => {
  for (const failBody of [false, true]) {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      if (!failBody) throw new Error("private-api-key-payload");
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("private-api-key-payload"));
          },
        }),
      );
    }) as typeof fetch;
    await expect(checkNowpaymentsConnection(config)).rejects.toMatchObject({
      code: "NOWPAYMENTS_UNAVAILABLE",
      message: "支付平台请求失败，请稍后重试。",
    });
  }
});

test("错误公共状态不可伪装可达", async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL) =>
    Response.json({ message: "maintenance" })) as typeof fetch;
  await expect(checkNowpaymentsConnection(config)).rejects.toMatchObject({
    code: "NOWPAYMENTS_DATA_INVALID",
  });
});

test("无效或含控制字符的商户币种不可进入终端输出", async () => {
  for (const payload of [
    {},
    { currencies: [1] },
    { currencies: ["btc\nforged log"] },
  ]) {
    globalThis.fetch = (async (input) =>
      String(input).endsWith("/status")
        ? Response.json({ message: "OK" })
        : Response.json(payload)) as typeof fetch;
    await expect(
      checkNowpaymentsConnection({
        ...config,
        NOWPAYMENTS_API_KEY: "test-key",
      }),
    ).rejects.toMatchObject({ code: "NOWPAYMENTS_DATA_INVALID" });
  }
});

test("供应商重定向不会携带密钥继续请求其他主机", async () => {
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls++;
    expect(init?.redirect).toBe("error");
    return String(input).endsWith("/status")
      ? Response.json({ message: "OK" })
      : new Response(null, {
          status: 302,
          headers: { Location: "https://example.com" },
        });
  }) as typeof fetch;
  await expect(
    checkNowpaymentsConnection({ ...config, NOWPAYMENTS_API_KEY: "test-key" }),
  ).rejects.toMatchObject({ code: "NOWPAYMENTS_UNAVAILABLE" });
  expect(calls).toBe(2);
});

// ---- 真实付款协议：无损金额、签名和托管 Invoice ----
test("IPN 验签包含全部字段和嵌套对象，修改金额或缺签名必须拒绝", () => {
  const canonical =
    '{"actually_paid":1,"extra":{"a":1,"z":2},"payment_id":123}';
  const raw =
    '{"payment_id":123,"extra":{"z":2,"a":1},"actually_paid":1.000000000000000001}';
  const signature = createHmac("sha512", "test-secret")
    .update(canonical)
    .digest("hex");
  expect(verifyNowpaymentsIpn(raw, signature, "test-secret")).toHaveProperty(
    "payment_id",
  );
  expect(() =>
    verifyNowpaymentsIpn(
      raw.replace("1.000000000000000001", "2"),
      signature,
      "test-secret",
    ),
  ).toThrow("支付签名无效");
  expect(() => verifyNowpaymentsIpn(raw, undefined, "test-secret")).toThrow(
    "支付签名无效",
  );
  expect(() => verifyNowpaymentsIpn(raw, signature, "other-secret")).toThrow(
    "支付签名无效",
  );
});
test("USD 使用整数美分，拒绝小于一美分的误差而非四舍五入", () => {
  expect(usdCents("19.20")).toBe(1920);
  expect(usdCents("1.92e1")).toBe(1920);
  expect(centsToUsd(1920)).toBe("19.20");
  expect(() => usdCents("19.200000000000000001")).toThrow();
  expect(() => usdCents("-5")).toThrow();
});
const sampleOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  environment: "sandbox",
  amount_cents: 500,
  sku: "credits_500",
  billing_interval: null,
  created_at: "2026-10-03T00:00:00Z",
} as PaymentOrder;
const clientConfig = {
  ...config,
  NOWPAYMENTS_API_KEY: "test-key",
  NOWPAYMENTS_EMAIL: "test@example.com",
  NOWPAYMENTS_PASSWORD: "test-password",
  PAYMENT_APP_ORIGIN: "https://app.example.com",
  PAYMENT_API_ORIGIN: "https://api.example.com",
};
test("Invoice 金额/回调/回跳由服务端设置且创建只发一次", async () => {
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls++;
    expect(String(input)).toBe("https://api-sandbox.nowpayments.io/v1/invoice");
    const body = JSON.parse(String(init?.body));
    expect(body.price_amount).toBe(5);
    expect(body.order_id).toBe(sampleOrder.id);
    expect(body.ipn_callback_url).toBe(
      "https://api.example.com/billing/webhooks/nowpayments",
    );
    expect(body.success_url).toContain(
      `/app/subscription?order=${sampleOrder.id}`,
    );
    expect(body.is_fee_paid_by_user).toBe(false);
    expect(body.is_fixed_rate).toBe(false);
    return Response.json({
      id: "456",
      order_id: sampleOrder.id,
      price_amount: "5.00",
      price_currency: "usd",
      invoice_url: "https://sandbox.nowpayments.io/payment/?iid=456",
    });
  }) as typeof fetch;
  expect(
    (await nowpaymentsClient(clientConfig).createInvoice(sampleOrder))
      .invoice_id,
  ).toBe("456");
  expect(calls).toBe(1);
});
test("Invoice 超时不盲目重试，跳转主机/环境/发票 ID 必须匹配", async () => {
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL): Promise<Response> => {
    calls++;
    throw new Error("timed out with private key");
  }) as typeof fetch;
  await expect(
    nowpaymentsClient(clientConfig).createInvoice(sampleOrder),
  ).rejects.toMatchObject({ code: "NOWPAYMENTS_UNAVAILABLE" });
  expect(calls).toBe(1);
  for (const url of [
    "https://evil.example/payment/?iid=456",
    "https://nowpayments.io/payment/?iid=456",
    "https://sandbox.nowpayments.io/payment/?iid=999",
    "https://sandbox.nowpayments.io@evil.example/payment/?iid=456",
  ])
    expect(() => validateCheckoutUrl(url, "sandbox", "456")).toThrow();
});
test("权威查单保留链上金额的全部精度，响应 payment ID 必须匹配", async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL) =>
    new Response(
      `{"payment_id":123,"invoice_id":456,"order_id":"${sampleOrder.id}","payment_status":"finished","price_amount":5,"price_currency":"usd","pay_amount":0.123456789012345678,"actually_paid":0.123456789012345679,"pay_currency":"eth","updated_at":"2026-10-03T00:00:00Z"}`,
    )) as typeof fetch;
  expect(
    (await nowpaymentsClient(clientConfig).getPayment("123")).actually_paid,
  ).toBe("0.123456789012345679");
  await expect(
    nowpaymentsClient(clientConfig).getPayment("999"),
  ).rejects.toMatchObject({ code: "NOWPAYMENTS_DATA_INVALID" });
});
test("第一条 IPN 丢失时通过带商户认证的完整分页发现 payment ID", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    if (url.pathname === "/v1/auth")
      return Response.json({ token: "short-lived-test-token" });
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer short-lived-test-token",
    );
    return Response.json({
      pagesCount: 2,
      data:
        url.searchParams.get("page") === "0"
          ? [{ order_id: "another", payment_id: 100 }]
          : [{ order_id: sampleOrder.id, payment_id: 123 }],
    });
  }) as typeof fetch;
  expect(
    await nowpaymentsClient(clientConfig).discoverPayments(sampleOrder),
  ).toEqual(["123"]);
  expect(paths).toEqual(["/v1/auth", "/v1/payment/", "/v1/payment/"]);
});

test("按官方 invoiceId 参数发现付款，并复用商户短期登录令牌", async () => {
  let logins = 0;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/auth") {
      logins++;
      const body = JSON.parse(String(init?.body));
      expect(body.password).toBe("  CaseSensitivePassword  ");
      return Response.json({ token: "temporary-merchant-token" });
    }
    expect(url.searchParams.get("invoiceId")).toBe("456");
    expect(url.searchParams.has("dateFrom")).toBe(false);
    return Response.json({
      pagesCount: 1,
      data: [{ order_id: sampleOrder.id, invoice_id: 456, payment_id: 123 }],
    });
  }) as typeof fetch;
  const client = nowpaymentsClient({
    ...clientConfig,
    NOWPAYMENTS_PASSWORD: "  CaseSensitivePassword  ",
  });
  const order = { ...sampleOrder, invoice_id: "456" };
  expect(await client.discoverPayments(order)).toEqual(["123"]);
  expect(await client.discoverPayments(order)).toEqual(["123"]);
  expect(logins).toBe(1);
});

test("即使 finished，权威响应标记重复或错币入金仍拒绝自动发放", async () => {
  for (const fields of [
    { parent_payment_id: 122 },
    { origin_type: "REPEATED" },
    { origin_type: "WRONG_ASSET" },
  ]) {
    globalThis.fetch = (async (_input: RequestInfo | URL) =>
      Response.json({
        payment_id: 123,
        invoice_id: 456,
        order_id: sampleOrder.id,
        payment_status: "finished",
        price_amount: 5,
        price_currency: "USD",
        pay_amount: 1,
        actually_paid: 1,
        pay_currency: "BTC",
        updated_at: "2026-10-03T00:00:00Z",
        ...fields,
      })) as typeof fetch;
    await expect(
      nowpaymentsClient(clientConfig).getPayment("123"),
    ).rejects.toMatchObject({ code: "PAYMENT_DEPOSIT_REQUIRES_REVIEW" });
  }
});

test("付款列表中发现重复入金不因相同发票自动合并", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith("/auth")
      ? Response.json({ token: "temporary-token" })
      : Response.json({
          pagesCount: 1,
          data: [
            {
              order_id: sampleOrder.id,
              invoice_id: 456,
              payment_id: 123,
              parent_payment_id: 122,
            },
          ],
        })) as typeof fetch;
  await expect(
    nowpaymentsClient(clientConfig).discoverPayments({
      ...sampleOrder,
      invoice_id: "456",
    }),
  ).rejects.toMatchObject({ code: "PAYMENT_DEPOSIT_REQUIRES_REVIEW" });
});

test("商户登录预检显式排序读取付款列表，不把接口 500 误判为密码错误", async () => {
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/status") return Response.json({message:"OK"});
    if (url.pathname === "/v1/merchant/coins") return Response.json({selectedCurrencies:["BTC"]});
    if (url.pathname === "/v1/auth") return Response.json({token:"test-login-token"});
    expect(url.searchParams.get("sortBy")).toBe("created_at");
    expect(url.searchParams.get("orderBy")).toBe("asc");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-login-token");
    return Response.json({data:[],pagesCount:0});
  }) as typeof fetch;
  expect((await checkNowpaymentsConnection(clientConfig)).discovery_auth).toBe("accepted");
});

test("商户净额扣费不改变用户实收金额，发放依据不使用 outcome_amount", async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL) => Response.json({
    payment_id:123,invoice_id:456,order_id:sampleOrder.id,payment_status:"finished",
    price_amount:5,price_currency:"usd",pay_amount:5,actually_paid:5,pay_currency:"usdttrc20",
    outcome_amount:4.99,outcome_currency:"usdttrc20",updated_at:"2026-10-03T00:00:00Z",
  })) as typeof fetch;
  const payment=await nowpaymentsClient(clientConfig).getPayment("123");
  expect(payment.actually_paid).toBe("5");expect(payment.pay_amount).toBe("5");
  expect(payment).not.toHaveProperty("outcome_amount");
});
