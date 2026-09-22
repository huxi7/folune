/**
 * [INPUT]: 依赖 Router 位置/原生过渡状态、Motion inView、DS 动态偏好与正文 data-marketing-reveal 标记
 * [OUTPUT]: 对外提供营销正文入场编排及原生过渡能力判据；首次访问、锚点和路由往返共用短距离浮现
 * [POS]: MarketingLayout 的视觉协调层；只命名当前视口内的内容，导轨不位移，滚动与历史仍由 Router 持有，query 不重播
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { inView } from "motion";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useViewTransitionState } from "react-router-dom";
import { staggerMaxMs, staggerStepMs } from "../../shared/design-system/motion";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const revealSelector = "[data-marketing-reveal]";
const maxStep = Math.floor(staggerMaxMs / staggerStepMs);

export function supportsMarketingTransition() {
  return typeof document !== "undefined"
    && typeof document.startViewTransition === "function"
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && CSS.supports("view-transition-class", "marketing-copy");
}

export function useMarketingMotion(rootRef: RefObject<HTMLDivElement | null>) {
  const { pathname, hash, search } = useLocation();
  const reduced = useMotionPreference();
  const routerTransition = useViewTransitionState(pathname);
  const transitioning = routerTransition && !reduced && supportsMarketingTransition();
  const routeKey = pathname + hash;
  const visit = useRef({ key: routeKey, pathname, search, sequence: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = visit.current;
    // 清除已消费的锚点并更新 detail query 是页内操作，不应重播当前章节。
    const changed = previous.pathname !== pathname
      || (previous.key !== routeKey && (hash !== "" || previous.search === search));
    visit.current = { key: routeKey, pathname, search, sequence: previous.sequence + Number(changed) };
    const elements = [...root.querySelectorAll<HTMLElement>(revealSelector)];
    const headerBottom = root.querySelector(".marketing-header")?.getBoundingClientRect().bottom ?? 0;
    const visible: HTMLElement[] = [];

    const settle = (element: HTMLElement) => { element.dataset.marketingPhase = "complete"; };
    const enter = (element: HTMLElement, step: number) => {
      element.style.setProperty("--marketing-delay", `${Math.min(step, maxStep) * staggerStepMs}ms`);
      element.dataset.marketingPhase = "entering";
    };

    // ---- 子级 ScrollRestoration 的 layout effect 已落位；只捕获用户真正看得到的内容 ----
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (reduced || rect.bottom <= headerBottom) {
        settle(element);
      } else if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight
        && rect.right > 0 && rect.left < window.innerWidth) {
        visible.push(element);
      } else if (!element.dataset.marketingPhase) {
        element.dataset.marketingPhase = "pending";
      }
    }

    visible.forEach((element, index) => {
      if (transitioning) {
        // 原生快照与 CSS 入场互斥，避免把半透明中间帧拍进新页面。
        settle(element);
        element.style.viewTransitionName = `marketing-copy-${visit.current.sequence}-${elements.indexOf(element)}`;
        element.style.setProperty("view-transition-class", `marketing-copy marketing-step-${Math.min(index, maxStep)}`);
      } else if (changed || element.dataset.marketingPhase !== "complete") {
        enter(element, index);
      }
    });

    let batchTime = -1;
    let batchStep = 0;
    const pending = elements.filter(element => element.dataset.marketingPhase === "pending");
    if (!("IntersectionObserver" in window)) pending.forEach(settle);
    const stop = !reduced && pending.length && "IntersectionObserver" in window ? inView(pending, (target, entry) => {
      const element = target as HTMLElement;
      if (transitioning) settle(element);
      else {
        if (entry.time !== batchTime) { batchTime = entry.time; batchStep = 0; }
        enter(element, batchStep++);
      }
    }, { margin: "0px 0px -24px 0px" }) : undefined;

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "marketing-reveal" && event.target instanceof HTMLElement) settle(event.target);
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("a,button,input,textarea,select")) return;
      const container = target.closest<HTMLElement>(revealSelector);
      if (container) settle(container);
      target.querySelectorAll<HTMLElement>(revealSelector).forEach(settle);
    };
    root.addEventListener("animationend", onAnimationEnd);
    root.addEventListener("focusin", onFocus);
    return () => {
      stop?.();
      root.removeEventListener("animationend", onAnimationEnd);
      root.removeEventListener("focusin", onFocus);
      elements.forEach(element => {
        element.style.removeProperty("view-transition-name");
        element.style.removeProperty("view-transition-class");
        element.style.removeProperty("--marketing-delay");
      });
    };
  }, [rootRef, routeKey, pathname, hash, search, reduced, transitioning]);

  return transitioning;
}
