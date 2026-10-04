/**
 * [INPUT]: 依赖共享余额、积分包接口、useCheckoutFlow 与购买弹窗
 * [OUTPUT]: 装配积分选购与一次点击结账，保留目录重试和关闭中止
 * [POS]: 只提交 pack ID 与幂等键，创建和付款核对由共享流程完成，不显示虚假到账
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { getCreditPacks, type CreditPackCatalog, type CreditPackId } from "../shared/api/subscription";
import { useBilling } from "../shared/api/useBilling";
import { useLocale } from "../shared/locale";
import { CreditsPurchaseDialog } from "../widgets/CreditsPurchaseDialog";
import { useCheckoutFlow } from "./useCheckoutFlow";

export function CreditsPage({ onBack, onUpgrade = onBack }: { onBack: () => void; onUpgrade?: () => void }) {
  const { overview } = useBilling();
  const { t } = useLocale();
  const [catalog, setCatalog] = useState<CreditPackCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"timeout" | "load" | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<CreditPackId | null>(null);
  const checkout = useCheckoutFlow("credits");

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

  function leave(action: () => void) { checkout.reset(); action(); }

  return <CreditsPurchaseDialog
    catalog={catalog}
    checkout={checkout.state}
    credits={overview?.credits ?? null}
    error={error === "timeout" ? t("加载积分包超时，请重试。", "Loading credit packs timed out. Please try again.") : error ? t("暂时无法加载积分包，请重试。", "Unable to load credit packs. Please try again.") : null}
    loading={loading}
    onCheckout={() => { if (selectedId) void checkout.start({ kind: "credits", pack_id: selectedId }); }}
    onClose={() => leave(onBack)}
    onRetry={() => setReload(value => value + 1)}
    onSelect={id => { checkout.reset(); setSelectedId(id); }}
    onUpgrade={() => leave(onUpgrade)}
    open
    selectedId={selectedId}
  />;
}
