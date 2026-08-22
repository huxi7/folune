/**
 * [INPUT]: 依赖 Design System 图标/Button 消费方提供的标题、影响说明与操作节点
 * [OUTPUT]: 对外提供 Composer 上方唯一的紧凑非模态审批表面
 * [POS]: AgentPanel 人工裁决的共享视觉原语；普通工具审批与 AI 整理审批必须经此同构，禁止再造独立卡片
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

import {
  ShieldWarningIcon,
  type Icon,
} from "../../shared/design-system/icons";

type ApprovalDockProps = {
  actions: ReactNode;
  ariaLabel?: string;
  description: string;
  icon?: Icon;
  status?: string;
  title: string;
};

export function ApprovalDock({
  actions,
  ariaLabel = "操作确认",
  description,
  icon: IconComponent = ShieldWarningIcon,
  status,
  title,
}: ApprovalDockProps) {
  return (
    <section
      aria-label={ariaLabel}
      aria-live="polite"
      className="agent-approval-dock"
      data-status={status}
      role="group"
    >
      <div className="agent-approval-dock-copy">
        <IconComponent aria-hidden="true" size={14} />
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
      <div className="agent-approval-dock-actions">{actions}</div>
    </section>
  );
}
