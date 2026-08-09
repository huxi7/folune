/**
 * [INPUT]: 依赖 React 退出生命周期、ThinkingMark、ThinkingStatusText 与 ai-message.css 的行内过渡
 * [OUTPUT]: 对外提供可淡出、无卡片的 Animated ThinkingMark + 动态真实状态文字 ThinkingIndicator
 * [POS]: design-system AI 活动态组合件，只在等待正文 token 或工具完成后继续生成时存在
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState } from "react";

import { ThinkingMark } from "./ThinkingMark";
import { ThinkingStatusText } from "./ThinkingStatusText";

export type ThinkingIndicatorProps = {
  active?: boolean;
  className?: string;
  label?: string;
  size?: number;
  statuses?: readonly string[];
};

const EXIT_DURATION_MS = 160;

export function ThinkingIndicator({
  active = true,
  className = "",
  label,
  size = 16,
  statuses,
}: ThinkingIndicatorProps) {
  const [present, setPresent] = useState(active);

  useEffect(() => {
    if (active) {
      setPresent(true);
      return;
    }

    if (!present) {
      return;
    }

    const timer = window.setTimeout(() => setPresent(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, present]);

  if (!present) {
    return null;
  }

  return (
    <div
      className={["ds-thinking-indicator", className].filter(Boolean).join(" ")}
      data-state={active ? "active" : "exiting"}
    >
      <ThinkingMark active aria-hidden="true" size={size} />
      <ThinkingStatusText label={label} messages={statuses} />
    </div>
  );
}
