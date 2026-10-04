/**
 * [INPUT]: 依赖 React 的 ref 与合成事件契约，以及触发器原有属性
 * [OUTPUT]: 对外提供原位 Tooltip 的事件组合与 React 19 ref 清理适配
 * [POS]: WarmTooltip 的无布局适配边界；提示先处理关闭/长按，再保留业务事件；普通点击/拖拽交还业务，长按抑制误触
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Ref, RefObject, SyntheticEvent } from "react";

export function attachTooltipRef(ownRef: RefObject<HTMLElement | null>, childRef: unknown, node: HTMLElement | null) {
  ownRef.current = node;
  const ref = childRef as Ref<HTMLElement> | undefined;
  const cleanup = typeof ref === "function" ? ref(node) : undefined;
  if (ref && typeof ref !== "function") ref.current = node;
  return () => {
    ownRef.current = null;
    if (typeof cleanup === "function") cleanup();
    else if (typeof ref === "function") ref(null);
    else if (ref) ref.current = null;
  };
}

export function composeTooltipTriggerProps(original: Record<string, unknown>, handlers: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, (event: SyntheticEvent) => {
    (handler as (event: SyntheticEvent) => void)(event);
    if (!event.isPropagationStopped() && !event.defaultPrevented) (original[name] as ((event: SyntheticEvent) => void) | undefined)?.(event);
  }]));
}
