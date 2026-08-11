/**
 * [INPUT]: 依赖 ReactNode、可选 className 与 Primary Button 共用的主题/零偏移环绕阴影 token
 * [OUTPUT]: 对外提供 user message 专用 UserMessageBubble
 * [POS]: design-system AI 消息家族的用户侧气泡，以主按钮同源表面统一产品视觉
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

type UserMessageBubbleProps = {
  children: ReactNode;
  className?: string;
};

export function UserMessageBubble({
  children,
  className = "",
}: UserMessageBubbleProps) {
  return (
    <div className={["ds-user-message-bubble", className].join(" ")}>
      {children}
    </div>
  );
}
