/**
 * [INPUT]: 依赖 React pointer/keyboard/effect 与父层提供的面板尺寸边界
 * [OUTPUT]: 对外提供支持拖拽、方向键、双击复位且拖拽期间声明全局 resize 状态的 PanelResizeHandle
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
  const dragStartRef = useRef<{ size: number; x: number } | null>(null);

  useEffect(() => () => {
    delete document.documentElement.dataset.panelResizing;
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = { size, x: event.clientX };
    document.documentElement.dataset.panelResizing = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;

    if (!dragStart) {
      return;
    }

    const delta = (event.clientX - dragStart.x) * direction;
    onResize(clamp(dragStart.size + delta, min, max));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = null;
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
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      role="separator"
      tabIndex={0}
    />
  );
}
