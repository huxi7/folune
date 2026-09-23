/**
 * [INPUT]: 依赖 React pointer/keyboard/effect 与父层提供的面板尺寸边界
 * [OUTPUT]: 对外提供局部渐隐焦点跟随指针、支持拖拽/方向键/双击复位的 PanelResizeHandle；捕获丢失时清理全局 resize 状态
 * [POS]: app/src/widgets 的工作台分隔栏，被 AppDashboard 用于 Sidebar 与 AgentPanel 宽度调整
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

type PanelResizeHandleProps = {
  ariaLabel: string;
  direction: 1 | -1;
  max: number;
  min: number;
  onReset: () => void;
  onResize: (size: number) => void;
  side: "left" | "right";
  size: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PanelResizeHandle({
  ariaLabel,
  direction,
  max,
  min,
  onReset,
  onResize,
  side,
  size,
}: PanelResizeHandleProps) {
  const dragStartRef = useRef<{ size: number; x: number; pointerId: number } | null>(null);

  useEffect(() => () => {
    delete document.documentElement.dataset.panelResizing;
  }, []);

  function updatePointerFocus(event: PointerEvent<HTMLDivElement>) {
    const handle = event.currentTarget;
    const bounds = handle.getBoundingClientRect();
    // ---- 视觉坐标直接写入 CSS，悬停不触发工作区 React 更新 ----
    handle.style.setProperty("--resize-focus-y", `${clamp(event.clientY - bounds.top, 0, bounds.height)}px`);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || dragStartRef.current) return;
    event.preventDefault();
    updatePointerFocus(event);
    dragStartRef.current = { size, x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.dataset.dragging = "true";
    document.documentElement.dataset.panelResizing = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (dragStart && dragStart.pointerId !== event.pointerId) return;
    updatePointerFocus(event);

    if (!dragStart) {
      return;
    }

    const delta = (event.clientX - dragStart.x) * direction;
    onResize(clamp(dragStart.size + delta, min, max));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId !== event.pointerId) return;
    dragStartRef.current = null;
    delete event.currentTarget.dataset.dragging;
    delete document.documentElement.dataset.panelResizing;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const keyboardDelta = event.key === "ArrowRight" ? 12 : -12;
    onResize(clamp(size + keyboardDelta * direction, min, max));
  }

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={Math.round(size)}
      className={`panel-resize-handle panel-resize-handle-${side}`}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      onFocus={(event) => event.currentTarget.style.removeProperty("--resize-focus-y")}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerEnter={updatePointerFocus}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      role="separator"
      tabIndex={0}
    />
  );
}
