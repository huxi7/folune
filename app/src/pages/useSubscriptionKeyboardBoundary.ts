/**
 * [INPUT]: 依赖 React effect 和 document 冒泡阶段的键盘事件
 * [OUTPUT]: 对外提供 useSubscriptionKeyboardBoundary，独立订阅页可见时隔离常驻工作区快捷键
 * [POS]: pages 的订阅交互边界；保留控件默认键盘行为与 Dialog 的 document 仲裁，仅阻止事件继续到隐藏画布的 window 监听器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";

export function useSubscriptionKeyboardBoundary(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const isolate = (event: KeyboardEvent) => event.stopPropagation();
    document.addEventListener("keydown", isolate);
    document.addEventListener("keyup", isolate);
    return () => {
      document.removeEventListener("keydown", isolate);
      document.removeEventListener("keyup", isolate);
    };
  }, [active]);
}
