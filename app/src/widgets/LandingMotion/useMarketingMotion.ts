/**
 * [INPUT]: 依赖 Router 位置、Motion inView、DS 营销配方与显式 reveal 分组
 * [OUTPUT]: 对外提供首屏同拍、文章行错峰与区块首次入视口的浮现编排
 * [POS]: MarketingLayout 的唯一内容入场协调层；滚动归 Router，query 不重播，焦点立即显示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { inView } from "motion";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { marketingMotion } from "../../shared/design-system/motion";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const revealSelector = "[data-marketing-reveal]";

export function useMarketingMotion(rootRef: RefObject<HTMLDivElement | null>) {
  const { pathname, hash, search } = useLocation();
  const reduced = useMotionPreference();
  const routeKey = pathname + hash;
  const visit = useRef({ key: routeKey, pathname, search });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = visit.current;
    // ---- 清除已消费锚点并更新 detail query，不重播当前章节 ----
    const changed = previous.pathname !== pathname
      || (previous.key !== routeKey && (hash !== "" || previous.search === search));
    visit.current = { key: routeKey, pathname, search };
    // 父组拥有完整动画；内部复用组件的标记不产生二次位移。
    const elements = [...root.querySelectorAll<HTMLElement>(revealSelector)]
      .filter(element => !element.parentElement?.closest(revealSelector));
    const headerBottom = root.querySelector(".marketing-header")?.getBoundingClientRect().bottom ?? 0;
    const settle = (element: HTMLElement) => { element.dataset.marketingPhase = "complete"; };
    const enter = (element: HTMLElement) => {
      const order = Number(element.dataset.marketingOrder ?? 0);
      const delay = element.dataset.marketingReveal === "row"
        ? Math.min(order * marketingMotion.rowStagger, marketingMotion.rowStaggerMax) : 0;
      element.style.setProperty("--marketing-delay", `${delay}ms`);
      element.dataset.marketingPhase = "entering";
    };

    // ---- ScrollRestoration 先落位；历史返回不把上方内容重新隐藏 ----
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (reduced || rect.bottom <= headerBottom) {
        settle(element);
      } else if (changed || !element.dataset.marketingPhase) {
        const visible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight
          && rect.right > 0 && rect.left < window.innerWidth;
        if (visible || element.dataset.marketingReveal === "row") enter(element);
        else element.dataset.marketingPhase = "pending";
      }
    }

    const pending = elements.filter(element => element.dataset.marketingPhase === "pending");
    if (!("IntersectionObserver" in window)) pending.forEach(settle);
    const stop = !reduced && pending.length && "IntersectionObserver" in window
      ? inView(pending, target => { enter(target as HTMLElement); }, { margin: marketingMotion.viewportMargin })
      : undefined;
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "marketing-reveal" && event.target instanceof HTMLElement) settle(event.target);
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("a,button,input,textarea,select")) return;
      // 键盘跳入隐藏区块时显示整组，包括嵌套标记外的父章节。
      elements.filter(element => element.contains(target) || target.contains(element)).forEach(settle);
    };
    root.addEventListener("animationend", onAnimationEnd);
    root.addEventListener("focusin", onFocus);
    return () => {
      stop?.();
      root.removeEventListener("animationend", onAnimationEnd);
      root.removeEventListener("focusin", onFocus);
    };
  }, [rootRef, routeKey, pathname, hash, search, reduced]);
}
