/**
 * [INPUT]: 依赖 Phosphor 工具/状态图标、工具名称/状态及可选输入输出载荷
 * [OUTPUT]: 对外提供与 AI 正文分离、可检查调用详情的 ToolCallBubble
 * [POS]: design-system AI 消息家族的工具活动气泡，独立承载调用状态而不污染正文排版
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  CheckCircleIcon,
  HourglassSimpleLowIcon,
  ToolboxIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

export type ToolCallState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

type ToolCallBubbleProps = {
  errorText?: string;
  input?: unknown;
  name: string;
  output?: unknown;
  state: ToolCallState;
};

const stateLabel: Record<ToolCallState, string> = {
  "input-streaming": "正在准备",
  "input-available": "正在调用",
  "approval-requested": "等待确认",
  "approval-responded": "已确认",
  "output-available": "调用完成",
  "output-error": "调用失败",
  "output-denied": "已取消",
};

function formatPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function ToolCallBubble({
  errorText,
  input,
  name,
  output,
  state,
}: ToolCallBubbleProps) {
  const failed = state === "output-error" || state === "output-denied";
  const finished = state === "output-available";
  const StatusIcon = failed
    ? WarningCircleIcon
    : finished
      ? CheckCircleIcon
      : HourglassSimpleLowIcon;
  const payload = errorText ?? output ?? input;

  return (
    <article className="ds-tool-call-bubble" data-state={state}>
      <header className="ds-tool-call-header">
        <span className="ds-tool-call-icon">
          <ToolboxIcon aria-hidden="true" size={15} weight="fill" />
        </span>
        <strong>{name}</strong>
        <span className="ds-tool-call-state">
          <StatusIcon aria-hidden="true" size={14} weight="bold" />
          {stateLabel[state]}
        </span>
      </header>
      {payload !== undefined ? (
        <details className="ds-tool-call-details">
          <summary>查看调用详情</summary>
          <pre>{formatPayload(payload)}</pre>
        </details>
      ) : null}
    </article>
  );
}
