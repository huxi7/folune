/**
 * [INPUT]: 依赖 Phosphor 图标节点与 WorkspaceChrome 开关命令
 * [OUTPUT]: 对外提供 Canvas/Panel Header 共用的固定尺寸 Ghost 图标开关与可访问名称
 * [POS]: app/src/widgets 的工作台边缘命令；以静止图标表达工具开关，不跨位置变形且不拥有开关状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

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
    <button
      aria-expanded={expanded}
      aria-label={action}
      className="edge-dock"
      data-mode={mode}
      data-side={side}
      onClick={onClick}
      title={action}
      type="button"
    >
      <span aria-hidden="true" className="edge-dock-icon">
        {icon}
      </span>
    </button>
  );
}
