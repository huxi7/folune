/**
 * [INPUT]: 依赖 React effect/ref、DOM 焦点/键盘/滚动状态、WarmTooltip 的描述关联与 Motion present 语义
 * [OUTPUT]: 对外提供 useModalLifecycle，协调多层模态的焦点、Escape、退出与滚动锁
 * [POS]: Dialog 的行为边界；行为不依赖动画时长，关闭即归还焦点，最后一层视觉退出才解除滚动锁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, type RefObject } from "react";

const stack: HTMLElement[] = [];
let scrollLocks = 0;
let originalOverflow = "";
export function useModalLifecycle(panelRef: RefObject<HTMLDivElement | null>, present: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => { if (--scrollLocks === 0) document.body.style.overflow = originalOverflow; };
  }, []);
  useEffect(() => {
    const panel = panelRef.current;
    if (!present || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(panel);
    const frame = requestAnimationFrame(() => {
      (panel.querySelector<HTMLElement>("[data-dialog-autofocus]") ?? panel).focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || stack.at(-1) !== panel) return;
      if (event.key === "Escape") {
        // 提示浮层先消费 Escape，下一次才关闭承载它的弹窗。
        if ([...panel.querySelectorAll('[aria-describedby]')].some((trigger) =>
          trigger.getAttribute('aria-describedby')?.split(/\s+/).some((id) => document.getElementById(id)?.getAttribute('role') === 'tooltip'),
        )) return;
        // 菜单先消费 Escape；仅在浮层完全收起后，下一次 Escape 才关外层 Dialog。
        if (panel.querySelector('[data-motion-surface][data-state="open"]:is([role="menu"],[role="listbox"])')) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.tabIndex >= 0 && !element.closest('[hidden],[inert],[aria-hidden="true"]'));
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); event.stopPropagation(); panel.focus(); return; }
      const active = document.activeElement;
      if (active === panel || !panel.contains(active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        event.stopPropagation();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    // Escape 先于画布；Tab 则让命令面板等控件先消费自己的语义快捷键。
    const captureEscape = (event: KeyboardEvent) => { if (event.key === "Escape") handleKeyDown(event); };
    const bubbleTab = (event: KeyboardEvent) => { if (event.key === "Tab") handleKeyDown(event); };
    document.addEventListener("keydown", captureEscape, true);
    document.addEventListener("keydown", bubbleTab);
    return () => {
      cancelAnimationFrame(frame);
      const index = stack.lastIndexOf(panel);
      if (index !== -1) stack.splice(index, 1);
      document.removeEventListener("keydown", captureEscape, true);
      document.removeEventListener("keydown", bubbleTab);
      // 新弹窗已取得焦点时，旧弹窗的延迟卸载不能把焦点抢回去。
      if (previous?.isConnected && (panel.contains(document.activeElement) || document.activeElement === document.body)) previous.focus({ preventScroll: true });
    };
  }, [panelRef, present]);
}
