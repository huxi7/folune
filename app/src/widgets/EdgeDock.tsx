/**
 * [INPUT]: 依赖 共享 Lucide 图标节点与 WorkspaceChrome 开关命令
 * [OUTPUT]: 对外提供 Stage 关闭态工具使用的固定尺寸 Ghost 图标入口与可访问名称
 * [POS]: app/src/widgets 的工作台边缘命令；只负责从 Stage 打开工具，不拥有 Panel 内部的关闭入口或开关状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

type EdgeDockProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  side: "left" | "right";
};

export function EdgeDock({
  icon,
  label,
  onClick,
  side,
}: EdgeDockProps) {
  const action = `打开${label}`;

  return (
    <button
      aria-expanded="false"
      aria-label={action}
      className="edge-dock"
      data-mode="stage"
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
