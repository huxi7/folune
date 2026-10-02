/**
 * [INPUT]: 依赖服务端积分包/日额度、双语locale、共享Dialog/Button/Skeleton及积分图标；顶部直接使用用户选定的同源蓝色生成图
 * [OUTPUT]: 对外提供受控积分购买弹窗，呈现六档报价、单选、支付状态、升级入口与可展开规则
 * [POS]: widgets 的积分选购展示层；不发网络请求、不生成钱包余额，支付事实与关闭行为交给页面装配
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import type { BillingCredits, CreditPack, CreditPackCatalog, CreditPackId } from "../shared/api/subscription";
import { Button, Dialog, Skeleton, SkeletonGroup, useDelayedSkeleton } from "../shared/design-system/components";
import { InfoIcon, SparkleIcon, XIcon } from "../shared/design-system/icons";
import { useLocale } from "../shared/locale";
import { formatCreditAmount } from "../shared/locale/credits";
import "../styles/credits-purchase.css";

export type CreditCheckoutState =
  | { status: "idle" | "loading" | "unavailable" }
  | { status: "error"; message: string }
  | { status: "ready"; checkoutUrl: string };

type CreditsPurchaseDialogProps = {
  open: boolean;
  catalog: CreditPackCatalog | null;
  credits: BillingCredits | null;
  loading: boolean;
  error: string | null;
  selectedId: CreditPackId | null;
  checkout: CreditCheckoutState;
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
  const skeletonVisible = useDelayedSkeleton(loading && !catalog);
  const selectedPack = catalog?.packs.find(pack => pack.id === selectedId);
  const pending = checkout.status === "loading";
  const preview = catalog?.status === "preview";
  const canPay = catalog?.checkout.available === true && !preview;
  const title = t("积分购买", "Buy credits");
  const tokensPerCredit = catalog?.tokens_per_credit ?? credits?.tokens_per_credit;

  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }} surface="bare" title={title}>
    <section className="folune-credits-purchase">
      <div aria-hidden="true" className="folune-credits-banner"><img alt="" src="/account/credits-header-blue.png" width={2170} height={725} decoding="async" draggable={false} /></div>
      <Button aria-label={t("关闭积分购买", "Close credit purchase")} className="folune-credits-close" icon={XIcon} onClick={onClose} size="square" variant="secondary" />
      <div className="folune-credits-body">
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

        {catalog ? <fieldset className="folune-credits-packs" disabled={pending}>
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
        </fieldset> : !error ? <SkeletonGroup className="folune-credits-packs" label={t("正在加载积分包", "Loading credit packs")} visible={skeletonVisible}>
          {Array.from({ length: 6 }, (_, index) => <Skeleton className="folune-credit-pack-skeleton" key={index} />)}
        </SkeletonGroup> : null}

        <div className="folune-credits-actions">
          <Button className="folune-credits-pay" disabled={!selectedPack} loading={pending} onClick={onCheckout} variant="primary">
            {pending ? t("正在准备", "Preparing")
              : checkout.status === "ready" ? t("前往支付", "Continue to payment")
              : canPay ? `${t("立即支付", "Pay now")} ${selectedPack ? priceLabel(selectedPack) : ""}`
              : `${t("购买积分", "Buy credits")}${selectedPack ? ` ${priceLabel(selectedPack)}` : ""}`}
          </Button>
          <Button className="folune-credits-upgrade" onClick={onUpgrade} variant="secondary">
            {t("或升级计划，获取更多每日积分", "Or upgrade your plan for more daily credits")}
          </Button>
        </div>

        {checkout.status === "unavailable" || checkout.status === "error" || checkout.status === "ready" ? <div aria-live="polite" className="folune-credits-status" role="status">
          <InfoIcon aria-hidden="true" size={16} />
          <p>{checkout.status === "error" ? checkout.message
            : checkout.status === "ready" ? t("支付页面已准备好，请再次确认后继续。", "Your checkout is ready. Review your selection before continuing.")
            : t("积分购买即将开放。本次没有产生订单或扣款。", "Credit purchases are coming soon. No order or charge was created.")}</p>
        </div> : null}

        <footer className="folune-credits-footer">
          <span>{preview || !canPay ? t("积分包预览，尚未开售。", "Credit pack preview. Sales are not open yet.") : t("付款前可再次确认金额。", "Review the total before paying.")}</span>{" "}
          <button aria-expanded={rulesOpen} className="folune-credits-rules-toggle" onClick={() => setRulesOpen(value => !value)} type="button">{t("查看积分规则", "View credit rules")}</button>
        </footer>
        {rulesOpen ? <div className="folune-credits-rules">
          {tokensPerCredit ? <p>{t(`1 积分对应 ${formatNumber(tokensPerCredit)} Token，对话、写作与整理共享用量，按实际消耗扣除。`, `1 credit equals ${formatNumber(tokensPerCredit)} tokens. Conversations, writing, and organization share the same usage allowance.`)}</p> : null}
          <p>{t("上方显示当前计划的今日剩余额度，每日北京时间 08:00 重置，不累计；它不是已购买积分余额。", "The balance above is today's remaining plan allowance. It resets at 00:00 UTC without rollover and is separate from purchased credits.")}</p>
          <p>{t("积分购买尚未开放，积分包报价为预览；购买积分的有效期与使用规则将在开售前公布。", "Credit packs and prices are previews. Expiration and usage terms will be published before sales open.")}</p>
        </div> : null}
      </div>
    </section>
  </Dialog>;
}
