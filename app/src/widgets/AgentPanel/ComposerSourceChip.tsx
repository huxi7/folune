/**
 * [INPUT]: 依赖调用方的来源标签、附加动作与移除回调，以及 WarmTooltip
 * [OUTPUT]: 提供笔记和画布共用的 ComposerSourceChip，透传外壳 ref 供浮层对齐
 * [POS]: 统一引用外壳与内部移除入口；来源状态由调用方持有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ReactNode, Ref } from "react";
import WarmTooltip from "../../shared/design-system/components/WarmTooltip";
import { XIcon } from "../../shared/design-system/icons";

export function ComposerSourceChip({ children, removeLabel, onRemove, disabled = false, ref }: {
  children: ReactNode;
  removeLabel: string;
  onRemove(): void;
  disabled?: boolean;
  ref?: Ref<HTMLSpanElement>;
}) {
  return <span className="agent-source-chip" ref={ref}>
    {children}
    <WarmTooltip asChild content={removeLabel}>
      <button type="button" aria-label={removeLabel} disabled={disabled} onClick={onRemove}>
        <XIcon size={14} />
      </button>
    </WarmTooltip>
  </span>;
}
