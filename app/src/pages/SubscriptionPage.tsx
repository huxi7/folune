/**
 * [INPUT]: 依赖共享计费目录、useCheckoutFlow 与订阅展示组件
 * [OUTPUT]: 装配月/年订阅的一次点击结账、无确认过渡与原位错误恢复
 * [POS]: 页面只投影服务端方案；付款导航和后台权益核对归共享结账编排
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { useLocale, type Locale } from "../shared/locale";
import type { Profile } from "../shared/api/profile";
import type { BillingPlan } from "../shared/api/subscription";
import { useBilling } from "../shared/api/useBilling";
import { SubscriptionWorkspace, type SubscriptionInterval, type SubscriptionPlan } from "../widgets/SubscriptionWorkspace";
import { useCheckoutFlow } from "./useCheckoutFlow";
import "../styles/subscription.css";

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
  const [interval, setInterval] = useState<SubscriptionInterval>("month");
  const checkout = useCheckoutFlow("subscription");
  const plans = catalog?.plans.filter(plan => plan.id !== "free").map(plan => toDisplayPlan(plan, locale)) ?? [];

  function selectPlan(plan: SubscriptionPlan) {
    if (plan.id !== "starter" && plan.id !== "pro" && plan.id !== "studio") return;
    void checkout.start({ kind: "subscription", plan_id: plan.id, billing_interval: interval === "year" ? "yearly" : "monthly" });
  }

  return <SubscriptionWorkspace
    currentInterval={overview?.subscription.billing_interval === "yearly" ? "year" : overview?.subscription.billing_interval === "monthly" ? "month" : null}
    currentPlanId={overview?.subscription.plan_id ?? null}
    error={error ? catalog ? t("账户信息刷新未成功，当前显示上次读取的方案。", "Unable to refresh your account. Showing the last available plans.") : error : null}
    interval={interval}
    loading={loading || refreshing}
    onBack={() => { checkout.reset(); onBack(); }}
    onIntervalChange={value => { checkout.reset(); setInterval(value); }}
    onRetry={() => void refresh()}
    onSelectPlan={selectPlan}
    plans={plans}
    profile={profile}
    credits={overview?.credits ?? null}
    onBuyCredits={() => { checkout.reset(); onBuyCredits(); }}
    checkout={checkout.state}
    onCheckoutRetry={checkout.retry}
  />;
}
