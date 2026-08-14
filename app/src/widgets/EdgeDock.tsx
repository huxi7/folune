/**
 * [INPUT]: 依赖 motion/react 的共享 layoutId、Phosphor 图标节点与 WorkspaceChrome 开关命令
 * [OUTPUT]: 对外提供 Canvas 边缘胶囊与 Panel Header 收起控制器的同一 EdgeDock 形态
 * [POS]: app/src/widgets 的 Paper First Signature 控件；只解释入口在 Canvas 与 Panel Header 之间的空间连续性，不拥有开关状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { panelSpring } from "../pages/workspaceMotion";

type EdgeDockProps = {
  expanded: boolean;
  icon: ReactNode;
  label: string;
  mode: "canvas" | "panel";
  onClick: () => void;
  side: "left" | "right";
};

export function EdgeDock({
  expanded,
  icon,
  label,
  mode,
  onClick,
  side,
}: EdgeDockProps) {
  const action = expanded ? `收起${label}` : `打开${label}`;

  return (
    <motion.button
      aria-expanded={expanded}
      aria-label={action}
      className="edge-dock"
      data-mode={mode}
      data-side={side}
      layoutId={`edge-dock-${side}`}
      onClick={onClick}
      title={action}
      transition={panelSpring}
      type="button"
    >
      <span aria-hidden="true" className="edge-dock-icon">
        {icon}
      </span>
      <span className="edge-dock-label">{label}</span>
    </motion.button>
  );
}
