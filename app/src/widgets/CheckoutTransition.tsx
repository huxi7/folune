/**
 * [INPUT]: 依赖双语 locale、共享 Button/Spinner 材质与结账生命周期
 * [OUTPUT]: 提供订阅/积分共用的结账展示状态、无确认过渡层和原位异常重试
 * [POS]: 购买流程的视觉交接；覆盖原选购区域，导航与付款事实归页面编排
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Button } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";
import "../styles/checkout-transition.css";

export type CheckoutState = { status: "idle" | "loading" | "error" | "unavailable"; message?: string };

export function CheckoutTransition({ summary }: { summary?: string }) {
  const { t } = useLocale();
  return <div className="folune-checkout-transition" role="status" aria-live="polite" aria-busy="true">
    <span aria-hidden="true" className="ds-button-spinner" />
    <strong>{t("正在前往收银台", "Opening checkout")}</strong>
    {summary ? <p>{summary}</p> : null}
  </div>;
}

export function CheckoutFeedback({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return <div className="folune-checkout-feedback" role="alert">
    <p>{message}</p>
    {onRetry ? <Button onClick={onRetry} variant="ghost">{t("重试", "Try again")}</Button> : null}
  </div>;
}
