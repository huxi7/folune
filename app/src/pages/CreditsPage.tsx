/**
 * [INPUT]: 依赖共享 BillingProvider 的真实日额度、积分包 API、双语 locale 与 CreditsPurchaseDialog
 * [OUTPUT]: 对外提供积分购买弹窗装配，处理目录/选择/结账、请求中止与关闭/升级命令
 * [POS]: pages 的积分选购流程；父级拥有订阅背景和路由，当前预留接口不创建订单、钱包或权益
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createCreditCheckout, getCreditPacks, type CreditPackCatalog, type CreditPackId } from "../shared/api/subscription";
import { useBilling } from "../shared/api/useBilling";
import { useLocale } from "../shared/locale";
import { CreditsPurchaseDialog, type CreditCheckoutState } from "../widgets/CreditsPurchaseDialog";

export function CreditsPage({ onBack, onUpgrade = onBack }: { onBack: () => void; onUpgrade?: () => void }) {
  const { overview } = useBilling();
  const { t } = useLocale();
  const [catalog, setCatalog] = useState<CreditPackCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"timeout" | "load" | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<CreditPackId | null>(null);
  const [checkout, setCheckout] = useState<CreditCheckoutState>({ status: "idle" });
  const checkoutVersion = useRef(0);
  const checkoutController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError(null);
    void getCreditPacks(controller.signal).then(next => {
      if (!current) return;
      setCatalog(next);
      setSelectedId(previous => next.packs.some(pack => pack.id === previous) ? previous : next.packs[0]?.id ?? null);
    }).catch(() => {
      if (current) setError(controller.signal.aborted ? "timeout" : "load");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (current) setLoading(false);
    });
    return () => { current = false; window.clearTimeout(timeout); controller.abort(); };
  }, [reload]);

  const cancelCheckout = useCallback(() => {
    checkoutVersion.current += 1;
    checkoutController.current?.abort();
    checkoutController.current = null;
  }, []);
  useEffect(() => cancelCheckout, [cancelCheckout]);

  async function prepareCheckout() {
    if (!selectedId || checkout.status === "loading") return;
    if (checkout.status === "ready") { window.location.assign(checkout.checkoutUrl); return; }
    cancelCheckout();
    const version = checkoutVersion.current;
    const controller = new AbortController();
    checkoutController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setCheckout({ status: "loading" });
    try {
      const result = await createCreditCheckout({ pack_id: selectedId }, controller.signal);
      if (version !== checkoutVersion.current) return;
      if (result.status === "ready") {
        const url = new URL(result.checkout_url);
        if (url.protocol !== "https:") throw new Error("Invalid checkout URL");
        setCheckout({ status: "ready", checkoutUrl: url.href });
      } else setCheckout({ status: "unavailable" });
    } catch {
      if (version !== checkoutVersion.current) return;
      setCheckout({ status: "error", message: controller.signal.aborted
        ? t("准备购买超时，请重试。", "Checkout timed out. Please try again.")
        : t("暂时无法准备购买，请重试。", "Unable to prepare checkout. Please try again.") });
    } finally { window.clearTimeout(timeout); }
  }

  function leave(action: () => void) { cancelCheckout(); action(); }

  return <CreditsPurchaseDialog
    catalog={catalog}
    checkout={checkout}
    credits={overview?.credits ?? null}
    error={error === "timeout" ? t("加载积分包超时，请重试。", "Loading credit packs timed out. Please try again.") : error ? t("暂时无法加载积分包，请重试。", "Unable to load credit packs. Please try again.") : null}
    loading={loading}
    onCheckout={() => void prepareCheckout()}
    onClose={() => leave(onBack)}
    onRetry={() => setReload(value => value + 1)}
    onSelect={id => { cancelCheckout(); setSelectedId(id); setCheckout({ status: "idle" }); }}
    onUpgrade={() => leave(onUpgrade)}
    open
    selectedId={selectedId}
  />;
}
