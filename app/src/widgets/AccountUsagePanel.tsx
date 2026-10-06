/**
 * [INPUT]: 依赖共享 useBilling 账户快照、服务端精确积分投影及统一显示策略、locale 文案/日期数字格式、DS Button/延迟数值Skeleton/AccountSubscribeButton 与真实方案入口
 * [OUTPUT]: 对外提供当前方案、每日额度、大数字用量、重置时刻与可重试刷新卡片
 * [POS]: app/src/widgets 的只读用量视图；与订阅页/菜单消费同一账单快照，额度按后端 token 事实换算，超限判定只认后端 exceeded
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useBilling } from "../shared/api/useBilling";
import { formatCreditAmount } from "../shared/locale/credits";
import { AccountSubscribeButton } from "../shared/design-system/components/AccountSubscribeButton";
import { Button, Skeleton, SkeletonGroup, useDelayedSkeleton } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";

export function AccountUsagePanel({ onViewPlans }: { onViewPlans: () => void }) {
  const { t, formatDate, locale } = useLocale();
  const formatCredits = (value: number) => formatCreditAmount(value, locale);
  const { catalog, overview, loading, refreshing, error, refresh } = useBilling();
  const usage = overview?.usage;
  const skeletonVisible = useDelayedSkeleton(loading && !usage);
  const plan = catalog?.plans.find((item) => item.id === overview?.subscription.plan_id);
  const usedPercent = usage ? Math.min(100, Math.max(0, usage.total_tokens / Math.max(1, usage.daily_limit) * 100)) : 0;
  const usedCredits = overview?.credits.used ?? 0;
  const totalCredits = overview?.credits.daily ?? 0;
  const resetsAt = usage ? new Date(usage.resets_at) : null;
  const resetLabel = resetsAt && Number.isFinite(resetsAt.getTime())
    ? formatDate(resetsAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <div className="settings-dialog-body">
      <section aria-labelledby="account-usage-title" className="account-dialog-section account-usage" aria-busy={loading || refreshing}>
        <header className="account-dialog-section-header account-dialog-section-header-action">
          <div>
            <h4 className="account-dialog-section-title" id="account-usage-title">{t("AI 使用积分", "AI credits")}</h4>
            <p className="account-dialog-section-description">{t("当前账户今日的 AI 使用情况。", "Today's AI usage for your account.")}</p>
          </div>
          <Button loading={refreshing} disabled={loading} onClick={() => void refresh()} aria-label={t("刷新用量", "Refresh usage")}>{t("刷新", "Refresh")}</Button>
        </header>
        <div className="account-dialog-rows">
          <div className="account-dialog-row account-usage-plan">
            <div className="account-dialog-row-copy">
              <p className="account-dialog-label">{t("当前计划", "Current plan")}</p>
              <p className="account-usage-plan-name">{overview?.subscription.plan_id === "free" ? t("免费版", "Free") : plan?.name ?? "—"}</p>
            </div>
            <div className="account-dialog-row-actions">
              <span className="account-usage-allowance">{usage ? t(`每日 ${formatCredits(totalCredits)} 积分`, `${formatCredits(totalCredits)} credits / day`) : "—"}</span>
              <AccountSubscribeButton onClick={onViewPlans}>{t("升级", "Upgrade")}</AccountSubscribeButton>
            </div>
          </div>
          <div className="account-usage-detail">
            <p className="account-dialog-label">{t("已用积分", "Credits used")}</p>
            <p className="account-dialog-section-description">{usage ? t(`当前周期 ${usage.usage_date}`, `Current period · ${formatDate(`${usage.usage_date}T00:00:00Z`, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}`) : t("按日统计 AI 使用量", "AI usage is measured daily")}</p>
            <div className="account-usage-number-row">
              <div className="account-usage-number">
                {usage ? <strong>{formatCredits(usedCredits)}</strong> : loading ? <SkeletonGroup visible={skeletonVisible} label={t("正在读取用量", "Loading usage")}><Skeleton className="account-usage-number-skeleton" shape="text" /></SkeletonGroup> : <strong>—</strong>}
                <span>{t("已用", "used")}</span>
              </div>
              <span className="account-usage-total">/ {usage ? formatCredits(totalCredits) : "—"}</span>
            </div>
            <div
              aria-label={t("今日积分用量", "Today's credit usage")}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={usage ? Math.round(usedPercent) : undefined}
              aria-valuetext={usage ? t(`已用 ${formatCredits(usedCredits)}，共 ${formatCredits(totalCredits)} 积分`, `${formatCredits(usedCredits)} of ${formatCredits(totalCredits)} credits used`) : t("用量尚未读取", "Usage has not loaded yet")}
              className="account-usage-meter"
              role="progressbar"
            >
              <span className="account-usage-meter-fill" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="account-usage-note" data-exceeded={usage?.exceeded}>
              {usage?.exceeded ? t("今日积分已用完。", "You've used today's credits.") : usage ? t(`剩余 ${formatCredits(overview!.credits.balance)} 积分。`, `${formatCredits(overview!.credits.balance)} credits remaining.`) : " "}
              {resetLabel ? t(` ${resetLabel} 重置。`, ` Resets ${resetLabel}.`) : ""}
            </p>
          </div>
        </div>
      </section>
      {error ? (
        <div className="account-dialog-load-error" role="status">
          <p>{overview ? t("本次刷新未成功，当前显示上次用量。", "Couldn't refresh. Your last usage details are shown.") : t("暂时无法读取用量，请重试。", "Your usage couldn't be loaded. Please try again.")}</p>
          <Button disabled={refreshing} onClick={() => void refresh()} variant="ghost">{t("重试", "Try again")}</Button>
        </div>
      ) : null}
    </div>
  );
}
