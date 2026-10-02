/**
 * [INPUT]: 依赖共享 useBilling 的服务端套餐目录/订阅事实、locale 双语文案与日期格式、DS Button 和独立订阅页入口
 * [OUTPUT]: 对外提供当前套餐、计费周期与付款状态卡片、免费账户空发票分组及紧凑订阅入口
 * [POS]: app/src/widgets 的账单设置栏；不从客户端选择推定付款成功，不伪造账单记录或直接改变权益
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useBilling } from "../shared/api/useBilling";
import { Button } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";

export function AccountBillingPanel({ onViewPlans }: { onViewPlans: () => void }) {
  const { t, formatDate } = useLocale();
  const statusLabels = {
    free: t("免费账户", "Free account"),
    active: t("订阅中", "Active"),
    past_due: t("付款待处理", "Payment pending"),
    canceled: t("已取消", "Canceled"),
    expired: t("已到期", "Expired"),
  } as const;
  const { catalog, overview, loading, refreshing, error, refresh } = useBilling();
  const subscription = overview?.subscription;
  const plan = catalog?.plans.find((item) => item.id === subscription?.plan_id);
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const hasPeriodEnd = periodEnd !== null && Number.isFinite(periodEnd.getTime());

  return (
    <div className="settings-dialog-body">
      <section aria-labelledby="account-billing-title" className="account-dialog-section" aria-busy={loading || refreshing}>
        <header className="account-dialog-section-header">
          <h4 className="account-dialog-section-title" id="account-billing-title">{t("套餐", "Plan")}</h4>
          <p className="account-dialog-section-description">{t("您当前的套餐和账单信息。", "Your current plan and billing details.")}</p>
        </header>
        <div className="account-dialog-rows">
          <div className="account-dialog-row">
            <div className="account-dialog-row-copy">
              <p className="account-dialog-label">{t("当前套餐", "Current plan")}</p>
              <p className="account-usage-plan-name">{subscription?.plan_id === "free" ? "Free" : plan?.name ?? (loading ? t("正在读取…", "Loading…") : "—")}</p>
            </div>
            <div className="account-dialog-row-actions"><Button onClick={onViewPlans} variant="primary">{t("订阅", "Subscribe")}</Button></div>
          </div>
          {subscription?.status !== "free" ? <div className="account-dialog-row">
            <p className="account-dialog-label">{t("订阅状态", "Status")}</p>
            <span className="account-dialog-value">{subscription ? subscription.cancel_at_period_end && subscription.status === "active" ? t("当前周期结束后取消", "Cancels at the end of this period") : statusLabels[subscription.status] : "—"}</span>
          </div> : null}
          {subscription?.billing_interval ? (
            <div className="account-dialog-row">
              <p className="account-dialog-label">{t("计费周期", "Billing cycle")}</p>
              <span className="account-dialog-value">{subscription.billing_interval === "yearly" ? t("按年订阅", "Yearly") : t("按月订阅", "Monthly")}</span>
            </div>
          ) : null}
          {hasPeriodEnd ? (
            <div className="account-dialog-row">
              <p className="account-dialog-label">{t("当前周期结束", "Current period ends")}</p>
              <time className="account-dialog-value" dateTime={subscription?.current_period_end ?? undefined}>{formatDate(periodEnd)}</time>
            </div>
          ) : null}
        </div>
      </section>
      {error ? (
        <div className="account-dialog-load-error" role="status">
          <p>{overview ? t("本次刷新未成功，当前显示上次订阅信息。", "Couldn't refresh. Your last subscription details are shown.") : t("暂时无法读取订阅信息，请重试。", "Your subscription details couldn't be loaded. Please try again.")}</p>
          <Button disabled={refreshing} onClick={() => void refresh()} variant="ghost">{t("重试", "Try again")}</Button>
        </div>
      ) : null}
      {subscription?.status === "free" ? <section className="account-dialog-section" aria-labelledby="account-invoice-title">
        <header className="account-dialog-section-header">
          <h4 className="account-dialog-section-title" id="account-invoice-title">{t("发票", "Invoices")}</h4>
          <p className="account-dialog-section-description">{t("查看您的付款记录和发票。", "Your payment history and invoices.")}</p>
        </header>
        <div className="account-dialog-rows"><div className="account-dialog-row"><p className="account-dialog-section-description">{t("暂无付款记录", "No payments yet")}</p></div></div>
      </section> : null}
    </div>
  );
}
