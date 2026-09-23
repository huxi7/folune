/**
 * [INPUT]: 依赖入口进度 Store、共享 BrandMark、轻弹进度落定时长、系统减少动态偏好与 workspace-entry.css
 * [OUTPUT]: 对外提供跨 loader/路由挂载持续存在的品牌加载层；100% 后单次斜纹彩光揭开工作区
 * [POS]: 应用入口的视觉边界；子路由持续装配，加载期间隔离交互，退出后不留下遮罩或重复动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { getWorkspaceEntryProgress, useWorkspaceEntryStore } from "../../shared/store/workspaceEntryStore";
import "../../styles/workspace-entry.css";

// ---- 完成阶段先让进度条抵达终点，再揭幕；只控制表现，不伪造加载进度 ----
export const WORKSPACE_ENTRY_MOTION = { settle: 640, reveal: 1000, reduced: 120 } as const;

export function WorkspaceEntryTransition({ children }: { children: ReactNode }) {
  const { id, phase, completed, dismiss } = useWorkspaceEntryStore();
  const reducedMotion = useMotionPreference();
  const { progress, label } = getWorkspaceEntryProgress(completed);
  const active = phase !== "idle";

  useEffect(() => {
    if (phase !== "complete") return;
    // animationend 为主；后台页暂停动画时仍保证最终释放交互。
    const timer = window.setTimeout(() => dismiss(id), reducedMotion
      ? WORKSPACE_ENTRY_MOTION.reduced
      : WORKSPACE_ENTRY_MOTION.settle + WORKSPACE_ENTRY_MOTION.reveal + 100);
    return () => window.clearTimeout(timer);
  }, [dismiss, id, phase, reducedMotion]);

  const style = {
    "--entry-settle": `${WORKSPACE_ENTRY_MOTION.settle}ms`,
    "--entry-reveal": `${WORKSPACE_ENTRY_MOTION.reveal}ms`,
    "--entry-reduced": `${WORKSPACE_ENTRY_MOTION.reduced}ms`,
    "--entry-progress": `${progress}%`,
  } as CSSProperties;

  return <>
    <div className="workspace-entry-content" inert={active} aria-hidden={active || undefined}>
      {children}
    </div>
    {active && <div className="workspace-entry" data-phase={phase} key={id} style={style}>
      <div className="workspace-entry-sheet">
        <div className="workspace-entry-composition">
          <BrandMark className="workspace-entry-brand" />
          <div className="workspace-entry-meter">
            <div className="workspace-entry-track" role="progressbar" aria-label="正在打开 Folune"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${label}，${progress}%`}>
              <div className="workspace-entry-fill" />
            </div>
            <p className="workspace-entry-label" role="status" aria-live="polite">{label}</p>
          </div>
        </div>
      </div>
      <div className="workspace-entry-shimmer" aria-hidden="true" onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && phase === "complete") dismiss(id);
      }} />
    </div>}
  </>;
}
