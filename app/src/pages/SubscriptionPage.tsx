/**
 * [INPUT]: 依赖共享 useBilling、支付接口、PaymentOrders 和既有订阅组件
 * [OUTPUT]: 装配月/年付款，打开收银台后跟踪同一订单，待核对可直接查看订单
 * [POS]: 页面只负责生命周期与导航，已付周期按服务端规则顺延，收银台在外部打开
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { PaymentOrders } from "../widgets/PaymentOrders";
import { openCheckout } from "../shared/api/payments";
import { useEffect, useRef, useState } from "react";

import { useLocale, type Locale } from "../shared/locale";
import type { Profile } from "../shared/api/profile";
import {
  createCheckout,
  type BillingPlan, type CheckoutResult,
} from "../shared/api/subscription";
import { useBilling } from "../shared/api/useBilling";
import { Button, Dialog, GlowButton } from "../shared/design-system/components";
import { CreditCardIcon, InfoIcon } from "../shared/design-system/icons";
import {
  SubscriptionWorkspace, formatSubscriptionPrice,
  type SubscriptionInterval, type SubscriptionPlan,
} from "../widgets/SubscriptionWorkspace";

import "../styles/subscription.css";

type Selection = { plan: SubscriptionPlan; interval: SubscriptionInterval; key: string };
type CheckoutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | CheckoutResult;

const planEnglish: Record<string, string> = {
  "从第一条记录，开始有序积累": "A home for your first ideas",
  "日常记录与轻量写作所需的一切": "Everything for everyday notes and writing",
  "高频记录者的从容之选": "More room for an everyday thinking practice",
  "为长文创作与深度研究而生": "Made for long-form writing and deep research",
  "AI 对话与写作 · 从提问到成稿": "AI chat & writing · From questions to drafts",
  "引用笔记 · 围绕你的资料回答": "Note references · Answers grounded in your notes",
  "智能归档 · 自动找到合适的位置": "Smart filing · Everything in its right place",
  "批量整理 · 一次处理多篇笔记": "Batch organizing · Work through notes together",
  "知识画布 · 让相关想法彼此连接": "Knowledge canvas · Connect related ideas",
  "可撤销操作 · 每次改动都有余地": "Reversible actions · Room to change your mind",
  "云端同步 · 网页与桌面接续记录": "Cloud sync · Pick up on web or desktop",
};
function toDisplayPlan(plan: BillingPlan, locale: Locale): SubscriptionPlan {
  return {
    currency: plan.prices.monthly.currency,
    description: locale === "en" ? planEnglish[plan.description] ?? plan.description : plan.description,
    features: locale === "en" ? plan.features.map(feature => planEnglish[feature] ?? feature) : plan.features,
    dailyCredits: plan.credits.daily,
    monthlyCredits: plan.credits.monthly,
    premium: plan.id === "pro" || plan.id === "studio",
    id: plan.id,
    name: plan.name,
    prices: { month: plan.prices.monthly.amount, year: plan.prices.yearly.amount },
    recommended: plan.highlighted,
  };
}

export function SubscriptionPage({ profile, onBack, onBuyCredits }: { profile: Profile; onBack: () => void; onBuyCredits: () => void }) {
  const { t, locale } = useLocale();
  const { catalog, overview, loading, refreshing, error, refresh } = useBilling();
  const [ordersOpen,setOrdersOpen]=useState(()=>new URLSearchParams(window.location.search).has("order"));
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("order") ?? undefined);
  const [adminOpen,setAdminOpen]=useState(false);
  const [interval, setInterval] = useState<SubscriptionInterval>("month");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState>({ status: "idle" });
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const plans = catalog?.plans.filter(plan => plan.id !== "free").map(plan => toDisplayPlan(plan, locale)) ?? [];


  useEffect(() => () => {
    requestVersion.current += 1;
    requestController.current?.abort();
  }, []);

  async function prepareCheckout(next: Selection) {
    const version = ++requestVersion.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setCheckout({ status: "loading" });
    if (next.plan.id !== "starter" && next.plan.id !== "pro" && next.plan.id !== "studio") {
      window.clearTimeout(timeout);
      setCheckout({ status: "error", message: t('此方案暂不可订阅，请刷新后重试。', 'This plan is unavailable. Refresh and try again.') });
      return;
    }
    try {
      const result = await createCheckout({
        plan_id: next.plan.id,
        idempotency_key: next.key,
        billing_interval: next.interval === "year" ? "yearly" : "monthly",
      }, controller.signal);
      if (version !== requestVersion.current) return;
      if (result.status === "ready") {
        const paymentUrl = new URL(result.checkout_url);
        if (paymentUrl.protocol !== "https:") throw new Error(t('暂时无法打开支付页面，请稍后重试。', 'Unable to open checkout. Please try again later.'));
      }
      setCheckout(result);
    } catch (failure) {
      if (version !== requestVersion.current) return;
      setCheckout({
        status: "error",
        message: controller.signal.aborted ? t('准备订阅超时，请重试。', 'Checkout took too long. Please try again.')
          : failure instanceof Error ? failure.message : t('订阅服务暂时不可用，请稍后重试。', 'Subscriptions are temporarily unavailable. Please try again later.'),
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function selectPlan(plan: SubscriptionPlan) {
    const next = { plan, interval, key:crypto.randomUUID() };
    setSelection(next);
    void prepareCheckout(next);
  }

  function closeCheckout() {
    requestVersion.current += 1;
    requestController.current?.abort();
    setSelection(null);
    setCheckout({ status: "idle" });
  }
  function showOrder(id?: string) {
    closeCheckout();
    setActiveOrderId(id);
    setOrdersOpen(true);
  }

  return (
    <>
      <SubscriptionWorkspace
        currentInterval={overview?.subscription.billing_interval === "yearly" ? "year" : overview?.subscription.billing_interval === "monthly" ? "month" : null}
        currentPlanId={overview?.subscription.plan_id ?? null}
        error={error ? catalog ? t('账户信息刷新未成功，当前显示上次读取的方案。', 'Unable to refresh your account. Showing the last available plans.') : error : null}
        interval={interval}
        loading={loading || refreshing}
        onBack={onBack}
        onIntervalChange={setInterval}
        onRetry={() => void refresh()}
        onSelectPlan={selectPlan}
        plans={plans}
        profile={profile}
        credits={overview?.credits ?? null}
        onBuyCredits={onBuyCredits}
        onOrders={()=>showOrder()}
        onAdmin={overview?.is_payment_admin?()=>setAdminOpen(true):undefined}
      />
      <PaymentOrders open={ordersOpen} orderId={activeOrderId} onClose={()=>setOrdersOpen(false)} />
      <PaymentOrders open={adminOpen} onClose={()=>setAdminOpen(false)} admin />
      <Dialog
        closeLabel={t("关闭", "Close")}
        description={t("确认适合你的方案与订阅周期。", "Confirm your plan and billing period.")}
        onOpenChange={(open) => { if (!open) closeCheckout(); }}
        open={selection !== null}
        title={t("订阅 Folune", "Subscribe to Folune")}
      >
        {selection ? (
          <CheckoutSummary
            checkout={checkout}
            onClose={closeCheckout}
            onRetry={() => void prepareCheckout(selection)}
            onOrder={showOrder}
            selection={selection}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function CheckoutSummary({ checkout, onClose, onRetry, onOrder, selection }: {
  checkout: CheckoutState;
  onClose: () => void;
  onRetry: () => void;
  onOrder: (id?: string) => void;
  selection: Selection;
}) {
  const { t } = useLocale();
  const { plan, interval } = selection;
  const amount = plan.prices[interval];
  const paymentPending = checkout.status === "loading";

  return (
    <div className="folune-subscription-checkout">
      <div className="folune-subscription-checkout-summary">
        <div className="folune-subscription-checkout-plan">
          <div>
            <h3>Folune {plan.name}</h3>
            <p>{interval === "year" ? t('一年使用期 · 单次付款', 'One year · One-time payment') : t('一个月使用期 · 单次付款', 'One month · One-time payment')}</p>
          </div>
          <CreditCardIcon aria-hidden="true" size={24} />
        </div>
        <div className="folune-subscription-checkout-total">
          <span>{interval === "year" ? t('年度金额', 'Annual total') : t('月度金额', 'Monthly total')}</span>
          <strong>{amount === null ? "—" : formatSubscriptionPrice(amount, plan.currency)}</strong>
        </div>
      </div>

      <div aria-live="polite" className="folune-subscription-checkout-status" role="status">
        <InfoIcon aria-hidden="true" size={16} />
        <div>
          <strong>{paymentPending ? t('正在准备订阅', 'Preparing your subscription') : checkout.status === "pending" ? t('订单正在核对', 'Checking your order') : checkout.status === "unavailable" ? t("在线订阅即将开放", "Subscriptions are coming soon") : checkout.status === "ready" ? t('可以继续前往支付', 'Ready for checkout') : t('暂时无法准备订阅', 'Unable to prepare checkout')}</strong>
          <p>
            {paymentPending ? t('正在确认方案与付款方式，请稍候。', 'Confirming your plan and payment options.')
              : checkout.status === "pending" ? t('订单已经创建，请查看订单进度，无需重复购买。', 'Your order exists. Check its progress without purchasing again.')
              : checkout.status === "unavailable" ? t('在线支付开放后，即可在这里完成订阅。当前方案保持不变。', 'You can subscribe here when payments open. Your current plan is unchanged.')
              : checkout.status === "ready" ? t('在支付页面完成付款后，你的订阅状态会自动更新。', 'Your subscription will update after payment is confirmed.')
              : checkout.status === "error" ? checkout.message : t('请稍后重试。', 'Please try again later.')}
          </p>
        </div>
      </div>

      <p className="folune-subscription-checkout-disclaimer">
        {checkout.status === "unavailable"
          ? t('本次没有产生订单或扣款，你仍可继续使用 Folune。', 'No order or charge was made. You can keep using Folune.')
          : t('选择方案不会立即扣款。付款前，你可以再次确认金额。', 'Choosing a plan does not charge you. Review the total before paying.')}
      </p>
      <div className="folune-subscription-checkout-actions">
        <Button onClick={onClose} variant={checkout.status === "unavailable" ? "primary" : "secondary"}>
          {checkout.status === "unavailable" ? t('返回方案', 'Back to plans') : t('取消', 'Cancel')}
        </Button>
        {paymentPending ? <Button disabled loading>{t('准备中', 'Preparing')}</Button> : null}
        {checkout.status === "error" ? <Button onClick={onRetry} variant="primary">{t('重试', 'Try again')}</Button> : null}
        {checkout.status === "pending" ? <Button onClick={() => onOrder(checkout.order_id)} variant="primary">{t('查看订单', 'View order')}</Button> : null}
        {checkout.status === "ready" ? (
          <GlowButton onClick={() => { openCheckout(checkout.checkout_url); onOrder(checkout.order_id); }}>{t('前往支付', 'Continue to payment')}</GlowButton>
        ) : null}
      </div>
    </div>
  );
}
