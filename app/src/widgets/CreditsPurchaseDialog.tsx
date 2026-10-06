/**
 * [INPUT]: 依赖服务端积分包/日额度、双语locale、共享Dialog/Button/Skeleton延迟占位及积分图标；顶部直接使用用户选定的同源蓝色生成图
 * [OUTPUT]: 对外提供 CreditsPurchaseDialog 受控购买弹窗与独立 CreditPacksSkeleton；关闭入口不重复提示，六档报价单选与骨架共用卡壳/图标/积分/价格结构，保留结账过渡及规则
 * [POS]: widgets 的积分选购展示层；首次无目录时延迟占位且不预判销售状态，目录到达立即可选且刷新保留已有卡片；不发请求、不生成余额，支付事实与关闭行为交给页面装配。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { CheckoutTransition, type CheckoutState } from "./CheckoutTransition";
import type { BillingCredits, CreditPack, CreditPackCatalog, CreditPackId } from "../shared/api/subscription";
import { Button, Dialog, Skeleton, SkeletonGroup, useDelayedSkeleton } from "../shared/design-system/components";
import { InfoIcon, SparkleIcon, XIcon } from "../shared/design-system/icons";
import { useLocale } from "../shared/locale";
import { formatCreditAmount } from "../shared/locale/credits";
import "../styles/credits-purchase.css";

type CreditsPurchaseDialogProps = {
  open: boolean;
  catalog: CreditPackCatalog | null;
  credits: BillingCredits | null;
  loading: boolean;
  error: string | null;
  selectedId: CreditPackId | null;
  checkout: CheckoutState;
  onSelect: (id: CreditPackId) => void;
  onCheckout: () => void;
  onRetry: () => void;
  onClose: () => void;
  onUpgrade: () => void;
};

const priceLabel = (pack: CreditPack) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: pack.price.currency,
  maximumFractionDigits: pack.price.amount % 100 === 0 ? 0 : 2,
}).format(pack.price.amount / 100);

export function CreditsPurchaseDialog({
  open, catalog, credits, loading, error, selectedId, checkout,
  onSelect, onCheckout, onRetry, onClose, onUpgrade,
}: CreditsPurchaseDialogProps) {
  const { t, formatNumber, locale } = useLocale();
  const [rulesOpen, setRulesOpen] = useState(false);
  const skeletonVisible = useDelayedSkeleton(loading && !catalog && !error, { minimumVisibleMs: 0 });
  const selectedPack = catalog?.packs.find(pack => pack.id === selectedId);
  const pending = checkout.status === "loading";
  const preview = catalog?.status === "preview";
  const canPay = catalog?.checkout.available === true && !preview;
  const title = t("积分购买", "Buy credits");
  const tokensPerCredit = catalog?.tokens_per_credit ?? credits?.tokens_per_credit;

  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }} surface="bare" title={title}>
    <section className="folune-credits-purchase">
      <div aria-hidden="true" className="folune-credits-banner"><img alt="" src="/account/credits-header-blue.png" width={2170} height={725} decoding="async" draggable={false} /></div>
      <Button aria-label={t("关闭积分购买", "Close credit purchase")} className="folune-credits-close" icon={XIcon} onClick={onClose} size="square" tooltip={false} variant="secondary" />
      <div className="folune-credits-body" inert={pending} aria-hidden={pending || undefined}>
        <header className="folune-credits-heading">
          <div>
            <h2>{title}</h2>
            <p>{t("积分用于在 Folune 中对话、写作与整理笔记。", "Credits power conversations, writing, and note organization in Folune.")}</p>
          </div>
          <div className="folune-credits-balance">
            <span>{t("当前积分余额", "Current credit balance")}</span>
            <strong><SparkleIcon aria-hidden="true" size={20} />{credits ? formatCreditAmount(credits.balance, locale) : "—"}</strong>
          </div>
        </header>

        {error ? <div className="folune-credits-error" role="alert">
          <p>{error}</p><Button onClick={onRetry}>{t("重新加载", "Try again")}</Button>
        </div> : null}

        {catalog ? <fieldset className="folune-credits-packs loading-content-reveal" disabled={pending}>
          <legend className="sr-only">{t("选择积分包", "Choose a credit pack")}</legend>
          {catalog.packs.map((pack, index) => <label aria-label={`${formatNumber(pack.credits)} ${t("积分", "credits")} ${priceLabel(pack)}`} className="folune-credit-pack" key={pack.id}>
            <input checked={selectedId === pack.id} name="credit-pack" onChange={() => onSelect(pack.id)} type="radio" value={pack.id} />
            <span className="folune-credit-pack-surface">
              <span aria-hidden="true" className="folune-credit-pack-icons">
                {Array.from({ length: Math.min(index + 1, 6) }, (_, mark) => <SparkleIcon key={mark} size={14} />)}
              </span>
              <strong>{formatNumber(pack.credits)}</strong>
              <span className="sr-only">{t("积分", "credits")}</span>
              <span className="folune-credit-pack-price">{priceLabel(pack)}</span>
            </span>
          </label>)}
        </fieldset> : !error && loading ? <CreditPacksSkeleton visible={skeletonVisible} /> : null}

        <div className="folune-credits-actions">
          <Button className="folune-credits-pay" disabled={!selectedPack} loading={pending} onClick={onCheckout} variant="primary">
            {pending ? t("正在前往收银台", "Opening checkout")
              : canPay ? `${t("立即支付", "Pay now")} ${selectedPack ? priceLabel(selectedPack) : ""}`
              : `${t("购买积分", "Buy credits")}${selectedPack ? ` ${priceLabel(selectedPack)}` : ""}`}
          </Button>
          <Button className="folune-credits-upgrade" onClick={onUpgrade} variant="secondary">
            {t("或升级计划，获取更多每日积分", "Or upgrade your plan for more daily credits")}
          </Button>
        </div>

        {checkout.status === "unavailable" || checkout.status === "error" ? <div aria-live="polite" className="folune-credits-status" role="status">
          <InfoIcon aria-hidden="true" size={16} />
          <p>{checkout.status === "error" ? checkout.message
            : t("积分购买即将开放。本次没有产生订单或扣款。", "Credit purchases are coming soon. No order or charge was created.")}</p>
        </div> : null}

        <footer className="folune-credits-footer">
          {catalog ? <span>{preview || !canPay ? t("积分包预览，尚未开售。", "Credit pack preview. Sales are not open yet.") : t("购买积分长期有效。", "Purchased credits do not expire.")}</span> : null}{" "}
          <button aria-expanded={rulesOpen} className="folune-credits-rules-toggle" onClick={() => setRulesOpen(value => !value)} type="button">{t("查看积分规则", "View credit rules")}</button>
        </footer>
        {rulesOpen ? <div className="folune-credits-rules">
          {tokensPerCredit ? <p>{t(`1 积分对应 ${formatNumber(tokensPerCredit)} Token，对话、写作与整理共享用量，按实际消耗扣除。`, `1 credit equals ${formatNumber(tokensPerCredit)} tokens. Conversations, writing, and organization share the same usage allowance.`)}</p> : null}
          <p>{t("可用余额包含今日剩余额度与购买积分。每日额度于北京时间 08:00 重置，优先使用；购买积分长期有效。", "Available balance combines daily and purchased credits. Daily credits reset at 00:00 UTC and are used first; purchased credits do not expire.")}</p>
          <p>{t("付款确认后到账。退款会冲正对应购买积分；已消耗部分形成欠额，由后续余额抵扣。", "Credits arrive after confirmed payment. Refunds reverse the purchase; spent credits become a balance adjustment.")}</p>
        </div> : null}
      </div>
      {pending ? <CheckoutTransition summary={selectedPack ? `${formatNumber(selectedPack.credits)} ${t("积分", "credits")} · ${priceLabel(selectedPack)}` : undefined} /> : null}
    </section>
  </Dialog>;
}

export function CreditPacksSkeleton({ visible }: { visible: boolean }) {
  const { t } = useLocale();
  return <SkeletonGroup className="folune-credits-packs folune-credits-packs-loading" label={t("正在加载积分包", "Loading credit packs")} visible={visible}>
    {Array.from({ length: 6 }, (_, index) => <div aria-hidden="true" className="folune-credit-pack-surface folune-credit-pack-skeleton" key={index}>
      <div className="folune-credit-pack-icons">
        <Skeleton className="folune-credit-pack-skeleton-icon" />
      </div>
      <Skeleton className="folune-credit-pack-skeleton-amount" shape="text" />
      <div className="folune-credit-pack-price">
        <Skeleton className="folune-credit-pack-skeleton-price" shape="text" />
      </div>
    </div>)}
  </SkeletonGroup>;
}
