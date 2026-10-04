/**
 * [INPUT]: 依赖公开套餐目录、共享金额/积分格式、MarketingAnnouncement 公告、BlogFrameSection/Blueprint 导轨、原页 Truchet 花纹、DS 按钮及营销导航
 * [OUTPUT]: 对外提供 /pricing 四档方案、月年报价切换、每日积分与目录重试；全部开始/订阅入口导航到 /login
 * [POS]: 营销壳内的匿名价格展示；仅投影服务端价格与权益，不装配账户遮罩、余额或结账生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBillingCatalog, type BillingCatalog, type BillingInterval, type BillingPlan } from "../shared/api/subscription";
import { Button, GlowButton, Skeleton, SkeletonGroup, useDelayedSkeleton } from "../shared/design-system/components";
import { CheckIcon } from "../shared/design-system/icons";
import { formatCreditAmount } from "../shared/locale/credits";
import { formatSubscriptionPrice } from "../shared/locale/money";
import { BlogFrameSection } from "../widgets/BlogFrameSection";
import { BlueprintDivider } from "../widgets/BlueprintDivider";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";
import { PricingRailPattern } from "../widgets/PricingRailPattern";
import { supportsMarketingTransition } from "../widgets/LandingMotion/useMarketingMotion";
import { usePublicPageMetadata } from "./usePublicPageMetadata";
import "../styles/pricing.css";

const CATALOG_TIMEOUT_MS = 15_000;

export function PricingPage() {
  const { pathname } = useLocation();
  const cycleId = useId();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const skeletonVisible = useDelayedSkeleton(loading);
  usePublicPageMetadata("价格方案", "从免费记录开始，选择适合自己的 Folune 方案。AI 对话、写作与智能归档，让想法自然积累。");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFailed(false);
    const timeout = window.setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
    void getBillingCatalog(controller.signal).then(value => {
      if (active) setCatalog(value);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return <BlueprintFrame key={pathname} className="landing-spine blog-spine pricing-spine" fullBleed>
    <main id="main-content">
      <MarketingAnnouncement />
      <BlogFrameSection>
        <div className="pricing-prelude" aria-hidden="true" />
        <BlueprintDivider flush fullBleed />
        <header className="pricing-heading">
          <h1 tabIndex={-1} data-marketing-reveal>为值得积累的想法而生的 Folune 订阅计划</h1>
          <p>随手记录，自动归档。让每一次思考，成为下一次创作的起点。</p>
          <div className="pricing-cycle" data-marketing-reveal>
            <label htmlFor={cycleId}>选择年付方案节省更多</label>
            <button id={cycleId} type="button" role="switch" aria-label="按年订阅" aria-checked={interval === "yearly"}
              className="pricing-switch" onClick={() => setInterval(value => value === "monthly" ? "yearly" : "monthly")}><span /></button>
          </div>
        </header>
        <BlueprintDivider fullBleed />
      </BlogFrameSection>
      <BlogFrameSection patterned>
        <PricingRailPattern />
        <section className="pricing-plans" aria-label="Folune 价格方案" aria-busy={loading}>
          {loading ? <SkeletonGroup className="pricing-grid" label="正在读取价格方案" visible={skeletonVisible}>
            {[0, 1, 2, 3].map(index => <div className="pricing-card pricing-card-loading" key={index}>
              <Skeleton shape="text" /><Skeleton shape="text" /><Skeleton className="pricing-skeleton-price" />
              <Skeleton shape="text" /><Skeleton shape="text" /><Skeleton shape="text" /><Skeleton />
            </div>)}
          </SkeletonGroup> : failed || !catalog?.plans.length ? <div className="pricing-error" role="alert">
            <p>暂时无法读取价格方案，请稍后重试。</p>
            <Button onClick={() => setAttempt(value => value + 1)} variant="secondary">重新加载</Button>
          </div> : <div className="pricing-grid">
            {catalog.plans.map(plan => <PricingCard key={plan.id} plan={plan} interval={interval} />)}
          </div>}
        </section>
        <BlueprintDivider flush fullBleed />
      </BlogFrameSection>
      <BlogFrameSection><div className="pricing-prelude" aria-hidden="true" /></BlogFrameSection>
    </main>
  </BlueprintFrame>;
}

function PricingCard({ plan, interval }: { plan: BillingPlan; interval: BillingInterval }) {
  const navigate = useNavigate();
  const free = plan.id === "free";
  const annual = !free && interval === "yearly";
  const price = plan.prices[annual ? "yearly" : "monthly"];
  const premium = plan.id === "pro" || plan.id === "studio";
  const label = free ? "免费开始" : `订阅 ${plan.name}`;
  const start = () => navigate("/login", { viewTransition: supportsMarketingTransition() });

  return <article className="pricing-card" data-plan-id={plan.id} data-recommended={plan.highlighted || undefined} aria-labelledby={`pricing-${plan.id}`}>
    <div className="pricing-card-top">
      <h2 id={`pricing-${plan.id}`}>{!free ? <>Folune<br /></> : null}{plan.name}</h2>
      {plan.highlighted ? <span className="pricing-badge"><span />流行</span> : null}
    </div>
    <p className="pricing-description">{plan.description}</p>
    <div className="pricing-price-block">
      <p className="pricing-price"><strong>{formatSubscriptionPrice(price.amount, price.currency)}</strong><span>/ {annual ? "年" : "月"}</span></p>
      <p className="pricing-price-note">{annual ? `${formatSubscriptionPrice(price.amount / 12, price.currency)} / 月` : "\u00a0"}</p>
    </div>
    <div className="pricing-card-body">
      <ul className="pricing-features">
        <li><CheckIcon size={14} aria-hidden="true" /><span>每日 <strong>{formatCreditAmount(plan.credits.daily)}</strong> 积分，用于 AI 对话、写作与整理</span></li>
        {plan.credits.monthly > 0 ? <li><CheckIcon size={14} aria-hidden="true" /><span>每月 <strong>{formatCreditAmount(plan.credits.monthly)}</strong> 额外赠送积分</span></li> : null}
        {plan.features.map(feature => {
          const [lead, ...detail] = feature.split(" · ");
          return <li key={feature}><CheckIcon size={14} aria-hidden="true" /><span>{detail.length ? <><strong>{lead}</strong> · {detail.join(" · ")}</> : feature}</span></li>;
        })}
      </ul>
    </div>
    {premium ? <GlowButton className="pricing-action" onClick={start}>{label}</GlowButton>
      : <Button className="pricing-action" variant={free ? "secondary" : "primary"} onClick={start}>{label}</Button>}
  </article>;
}
