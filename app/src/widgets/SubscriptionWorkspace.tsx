/**
 * [INPUT]: 依赖服务端套餐/积分投影、双语 locale 与共享 money 金额显示、React 聚焦、Button/GlowButton/Skeleton 延迟占位与 Folune 图标
 * [OUTPUT]: 对外提供 SubscriptionWorkspace 订阅展示与可独立验收的 SubscriptionPlanSkeleton；关闭入口不重复提示，三档方案/年付/CTA/积分条与同卡壳骨架共用槽位
 * [POS]: widgets 的订阅展示层；首次无方案时延迟显示占位，数据就绪立即进入原卡片，刷新保留已有方案；报价/余额不在 UI 生成，购买直接进入无确认过渡，不承载订单与管理界面。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useId, useRef } from "react";
import { CheckoutFeedback, CheckoutTransition, type CheckoutState } from "./CheckoutTransition";
import { Button, GlowButton, Skeleton, SkeletonGroup, useDelayedSkeleton } from "../shared/design-system/components";
import { ArrowCounterClockwiseIcon, CheckIcon, InfoIcon, PlusIcon, SparkleIcon, XIcon } from "../shared/design-system/icons";
import { type BillingCredits } from "../shared/api/subscription";

import { useLocale } from "../shared/locale";
import { formatCreditAmount } from "../shared/locale/credits";
import { formatSubscriptionPrice } from "../shared/locale/money";
export { formatSubscriptionPrice } from "../shared/locale/money";

export type SubscriptionInterval = "month" | "year";
export type SubscriptionPlan = {
  currency: string;
  description: string;
  features: readonly string[];
  id: string;
  name: string;
  prices: { month: number; year: number | null };
  dailyCredits: number;
  monthlyCredits: number;
  premium?: boolean;
  recommended?: boolean;
};
export type SubscriptionWorkspaceProps = {
  currentInterval: SubscriptionInterval | null;
  currentPlanId: string | null;
  credits: BillingCredits | null;
  error: string | null;
  interval: SubscriptionInterval;
  loading: boolean;
  onBack: () => void;
  onBuyCredits: () => void;
  checkout?: CheckoutState;
  onCheckoutRetry?: () => void;
  onIntervalChange: (interval: SubscriptionInterval) => void;
  onRetry: () => void;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  plans: readonly SubscriptionPlan[];
  profile: { avatarUrl: string | null; username: string };
};

export function SubscriptionWorkspace({
  currentInterval, currentPlanId, credits, error, interval, loading, onBack, onBuyCredits,
  onIntervalChange, onRetry, onSelectPlan, plans, profile, checkout, onCheckoutRetry,
}: SubscriptionWorkspaceProps) {
  const { t, locale } = useLocale();
  const formatCredits = (value: number) => formatCreditAmount(value, locale);
  const skeletonVisible = useDelayedSkeleton(loading && plans.length === 0 && !error, { minimumVisibleMs: 0 });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cycleId = useId();
  const hasAnnualPlan = plans.some(plan => plan.id !== "free" && plan.prices.year !== null);
  const hasAnnualSaving = plans.some(plan => plan.prices.year !== null && plan.prices.year < plan.prices.month * 12);
  const currentPlan = plans.find(plan => plan.id === currentPlanId);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <main className="folune-subscription" aria-labelledby="subscription-title">
      <div className="folune-subscription-ambient" aria-hidden="true" />
      <Button aria-label={t("关闭订阅页面", "Close subscription page")} className="folune-subscription-close" icon={XIcon} onClick={onBack} size="square" tooltip={false} variant="ghost" />
      <div className="folune-subscription-inner" inert={checkout?.status === "loading"} aria-hidden={checkout?.status === "loading" || undefined}>
        <header className="folune-subscription-heading">
          <h1 id="subscription-title" ref={titleRef} tabIndex={-1}>{t('为值得积累的想法而生的 Folune 订阅计划', 'Folune plans for ideas worth keeping')}</h1>
          <p className="folune-subscription-description">{t('随手记录，自动归档。让每一次思考，成为下一次创作的起点。', 'Capture freely. Organize naturally. Give every idea a place to grow.')}</p>
        </header>
        <div className="folune-subscription-cycle">
          <label htmlFor={cycleId}>{hasAnnualSaving ? t("选择年付方案节省更多", "Save more with annual billing") : t("选择年付方案，专注长久积累", "Choose annual billing for the long run")}</label>
          <button
            aria-checked={interval === "year"} aria-label={t("按年订阅", "Annual billing")} className="folune-subscription-switch"
            disabled={!hasAnnualPlan} id={cycleId} onClick={() => onIntervalChange(interval === "year" ? "month" : "year")}
            role="switch" type="button"
          ><span aria-hidden="true" /></button>
        </div>
        {checkout?.message ? <CheckoutFeedback message={checkout.message} onRetry={checkout.status === "error" ? onCheckoutRetry : undefined} /> : null}
        {error ? (
          <div className="folune-subscription-error" role="alert">
            <InfoIcon aria-hidden="true" size={16} /><span>{error}</span>
            <Button icon={ArrowCounterClockwiseIcon} loading={loading} onClick={onRetry}>{t('重试', 'Try again')}</Button>
          </div>
        ) : null}
        {!error && loading && plans.length === 0 ? (
          <SubscriptionPlanSkeleton visible={skeletonVisible} />
        ) : plans.length > 0 ? (
          <section aria-label={t("Folune 订阅方案", "Folune plans")} className="folune-subscription-grid loading-content-reveal">
            {plans.map(plan => (
              <SubscriptionPlanCard
                current={plan.id === currentPlanId && (plan.id === "free" || interval === currentInterval)} interval={interval} key={plan.id}
                onSelect={() => plan.id === "free" ? onBack() : onSelectPlan(plan)} plan={plan}
              />
            ))}
          </section>
        ) : !error ? <p className="folune-subscription-empty" role="status">{t('订阅计划正在准备中', 'Plans are on their way')}</p> : null}
        <div className="folune-subscription-account-scroll">
          <div className="folune-subscription-account" aria-label={t("当前账户积分", "Account credits")}>
            <strong className="folune-subscription-account-name">{profile.username}</strong>
            <span>{currentPlan?.name ?? (currentPlanId === "free" ? "Free" : "—")}</span>
            <span className="folune-subscription-account-divider" aria-hidden="true" />
            <span>{t("每日积分", "Daily credits")} <strong>{credits ? formatCredits(credits.daily) : "—"}</strong></span>
            <span>{t("购买积分", "Purchased credits")} <strong>{credits ? formatCredits(credits.purchased ?? 0) : "—"}</strong></span>
            <span className="folune-subscription-account-divider" aria-hidden="true" />
            <span className="folune-subscription-balance"><SparkleIcon aria-hidden="true" size={16} />{t("当前余额", "Balance")} <strong>{credits ? formatCredits(credits.balance) : "—"}</strong> {t("积分", "credits")}</span>
            <Button className="folune-subscription-buy-credits" icon={PlusIcon} onClick={onBuyCredits} variant="ghost">{t('购买积分', 'Buy credits')}</Button>
          </div>
        </div>
        <div className="folune-subscription-help">
          <p>{t("仅供个人使用 · 受我们的", "For personal use · Our ")}<a href="/terms" rel="noreferrer" target="_blank">{t('服务条款', 'Terms of service')}</a>{t("约束", " apply")}</p>
          <details className="folune-subscription-credit-rules">
            <summary>{t('积分如何使用？', 'How do credits work?')}</summary>
            <div className="folune-subscription-credit-rules-content">
              {credits ? <p>{t(`1 积分 = ${credits.tokens_per_credit.toLocaleString("zh-CN")} Token。用量最多显示一位小数，后台按实际 Token 记账。`, `1 credit = ${credits.tokens_per_credit.toLocaleString("en")} tokens. Usage displays up to one decimal; actual tokens are recorded.`)}</p> : null}
              <p>{t('AI 对话、写作、整理与画布探索共用积分，按处理内容的用量扣除，不按固定对话次数计费。', 'AI chat, writing, organizing and canvas exploration share credits. Usage depends on the content processed, not a fixed number of conversations.')}</p>
              <p>{t('每日积分在 UTC 00:00（北京时间 08:00）刷新，不累计到下一天。目前每月额外赠送积分为 0，余额为当日剩余可用积分。', 'Daily credits reset at 00:00 UTC and do not roll over. Monthly bonus credits are currently zero. Your balance is today’s remaining allowance.')}</p>
              <p>{t('普通笔记编辑不消耗积分。购买积分功能尚未开放。', 'Editing notes does not use credits. Credit purchases are coming soon.')}</p>
            </div>
          </details>
        </div>
        <footer className="folune-subscription-legal">
          <div><span>Folune</span><span aria-hidden="true">·</span><span>{t('随手记下，自然有序', 'A place for every thought')}</span><span aria-hidden="true">·</span><a href="/blog" rel="noreferrer" target="_blank">{t('阅读与灵感', 'Ideas & reading')}</a></div>
          <div><a href="/terms" rel="noreferrer" target="_blank">{t('服务条款', 'Terms of service')}</a><span aria-hidden="true">·</span><a href="/privacy" rel="noreferrer" target="_blank">{t('隐私政策', 'Privacy policy')}</a></div>
        </footer>
      </div>
      {checkout?.status === "loading" ? <CheckoutTransition /> : null}
    </main>
  );
}

function SubscriptionPlanCard({ current, interval, onSelect, plan }: {
  current: boolean; interval: SubscriptionInterval; onSelect: () => void; plan: SubscriptionPlan;
}) {
  const { t, locale } = useLocale();
  const formatCredits = (value: number) => formatCreditAmount(value, locale);
  const free = plan.id === "free";
  const annual = interval === "year" && !free;
  const amount = plan.prices[annual ? "year" : "month"];
  const annualSaving = annual && amount !== null && plan.prices.month > 0 ? Math.round((1 - amount / (plan.prices.month * 12)) * 100) : 0;
  const label = free ? current ? t("当前方案", "Current plan") : t("返回工作区", "Back to workspace") : current ? t(`续费 ${plan.name}`, `Renew ${plan.name}`) : t(`订阅 ${plan.name}`, `Subscribe to ${plan.name}`);
  return (
    <article className="folune-subscription-plan" data-plan-id={plan.id} data-recommended={plan.recommended || undefined}>
      <div className="folune-subscription-plan-content">
        <div className="folune-subscription-plan-topline">
          <h2 className="folune-subscription-tier" aria-label={`Folune ${plan.name}`}>
            <span className="folune-subscription-tier-brand" aria-hidden="true">Folune</span>
            <span className="folune-subscription-tier-word" aria-hidden="true">
              <span className="folune-subscription-tier-chip" />
              <span className="folune-subscription-tier-sharp">{plan.name}</span>
              <span className="folune-subscription-tier-blurred">{plan.name}</span>
            </span>
          </h2>
          {plan.recommended ? <span className="folune-subscription-plan-badge">{t('流行', 'Popular')}</span> : null}
        </div>
        <p className="folune-subscription-plan-description">{plan.description}</p>
        <div className="folune-subscription-price-block">
          <p className="folune-subscription-price">
            <strong>{amount === null ? "—" : formatSubscriptionPrice(amount, plan.currency)}</strong>
            <span>/ {annual ? t("年", "year") : t("月", "month")}</span>
            {annualSaving > 0 ? <span className="folune-subscription-saving">{t("节省", "Save")} {annualSaving}%</span> : null}
          </p>
          <p className="folune-subscription-price-note">{amount === null ? t("此方案暂不提供年付", "Annual billing is unavailable") : annual ? `${formatSubscriptionPrice(amount / 12, plan.currency)} / ${t("月", "month")}` : "\u00a0"}</p>
        </div>
        <ul className="folune-subscription-features">
          <li><CheckIcon aria-hidden="true" size={14} /><span>{t("每日", "Every day:")} <strong>{formatCredits(plan.dailyCredits)}</strong> {t("积分，用于 AI 对话、写作与整理", "credits for AI chat, writing and organizing")}</span></li>
          {plan.monthlyCredits > 0 ? <li><CheckIcon aria-hidden="true" size={14} /><span>{t("每月", "Every month:")} <strong>{formatCredits(plan.monthlyCredits)}</strong> {t("额外赠送积分", "bonus credits")}</span></li> : null}
          {plan.features.map(feature => {
            const [lead, ...rest] = feature.split(" · ");
            return <li key={feature}><CheckIcon aria-hidden="true" size={14} /><span>{rest.length ? <><strong>{lead}</strong> · {rest.join(" · ")}</> : feature}</span></li>;
          })}
        </ul>
        <div className="folune-subscription-plan-action">
          {plan.premium && !current ? <GlowButton className="folune-subscription-plan-button" disabled={amount === null} onClick={onSelect}>{label}</GlowButton>
            : <Button className="folune-subscription-plan-button" disabled={free && current || amount === null} onClick={onSelect} variant="primary">{label}</Button>}
        </div>
      </div>
    </article>
  );
}

export function SubscriptionPlanSkeleton({ visible }: { visible: boolean }) {
  const { t } = useLocale();
  return <SkeletonGroup className="folune-subscription-grid" label={t("正在读取订阅方案", "Loading plans")} visible={visible}>
    {[0, 1, 2].map(index => <div aria-hidden="true" className="folune-subscription-plan folune-subscription-plan-loading" key={index}>
      <div className="folune-subscription-plan-content">
        <div className="folune-subscription-plan-topline">
          <div className="folune-subscription-tier">
            <Skeleton className="folune-subscription-skeleton-brand" shape="text" />
            <Skeleton className="folune-subscription-skeleton-name" shape="text" />
          </div>
        </div>
        <div className="folune-subscription-plan-description">
          <Skeleton className="folune-subscription-skeleton-description" shape="text" />
        </div>
        <div className="folune-subscription-price-block">
          <div className="folune-subscription-price">
            <Skeleton className="folune-subscription-skeleton-price" shape="text" />
            <Skeleton className="folune-subscription-skeleton-period" shape="text" />
          </div>
          <div className="folune-subscription-price-note">
            <Skeleton className="folune-subscription-skeleton-note" shape="text" />
          </div>
        </div>
        <ul className="folune-subscription-features">
          {[0, 1, 2, 3, 4].map(row => <li key={row}>
            <Skeleton className="folune-subscription-skeleton-feature-icon" />
            <Skeleton className="folune-subscription-skeleton-feature" shape="text" />
          </li>)}
        </ul>
        <div className="folune-subscription-plan-action">
          <Skeleton className="folune-subscription-skeleton-button" />
        </div>
      </div>
    </div>)}
  </SkeletonGroup>;
}
