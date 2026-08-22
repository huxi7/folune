/**
 * [INPUT]: 依赖 React 状态/interval 与调用方提供的真实中性状态文案
 * [OUTPUT]: 对外提供固定宽度、低频交叉淡化且只有单一读屏播报源的 ThinkingStatusText
 * [POS]: design-system AI 活动态文字原子件，只表达真实等待语义，不推断搜索、读取或工具行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState } from "react";

export const DEFAULT_THINKING_STATUSES = [
  "正在思考…",
  "正在整理思路…",
  "正在组织回答…",
] as const;

export type ThinkingStatusTextProps = {
  className?: string;
  intervalMs?: number;
  label?: string;
  messages?: readonly string[];
};

export function ThinkingStatusText({
  className = "",
  intervalMs = 2_800,
  label,
  messages = DEFAULT_THINKING_STATUSES,
}: ThinkingStatusTextProps) {
  const statuses = messages.length > 0 ? messages : DEFAULT_THINKING_STATUSES;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [statuses]);

  useEffect(() => {
    if (statuses.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % statuses.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, statuses]);

  return (
    <span className={["ds-thinking-status-text", className].filter(Boolean).join(" ")}>
      {statuses.map((status, index) => (
        <span
          aria-hidden="true"
          data-active={index === activeIndex || undefined}
          key={`${index}-${status}`}
        >
          {status}
        </span>
      ))}
      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {label ?? statuses[activeIndex]}
      </span>
    </span>
  );
}
