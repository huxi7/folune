/**
 * [INPUT]: 依赖 React 生命周期、Motion useInView 与共享 DS useMotionPreference
 * [OUTPUT]: 对外提供装饰宿主 ref、运行状态与系统动态偏好
 * [POS]: 首屏候选的动态生命周期边界；运行状态交给真实 Shader 的 speed，库内部继续处理画布可见性
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useRef, useSyncExternalStore } from "react";
import { useInView } from "motion/react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const subscribe = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const visible = () => document.visibilityState === "visible";

export function useAmbientMotion(paused: boolean) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const foreground = useSyncExternalStore(subscribe, visible, () => true);
  const reduced = useMotionPreference();
  const running = inView && foreground && !reduced && !paused;

  return { ref, running, reduced };
}
