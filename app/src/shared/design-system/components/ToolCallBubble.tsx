/**
 * [INPUT]: 依赖 Phosphor 工具/状态图标、工具显示名与 AI SDK 调用状态
 * [OUTPUT]: 对外提供不暴露调用载荷、执行中带流光、完成态带灰阶对勾的 ToolCallBubble
 * [POS]: design-system AI 消息家族的极简工具状态控件，以 Secondary Button 同源材质独立于 AI 正文排版
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  CheckIcon,
  ToolboxIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
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
  icon?: Icon;
  name: string;
  state: ToolCallState;
};

const stateLabel: Record<ToolCallState, string> = {
  "input-streaming": "正在准备",
  "input-available": "正在调用",
  "approval-requested": "等待确认",
  "approval-responded": "正在调用",
  "output-available": "调用完成",
  "output-error": "调用失败",
  "output-denied": "已取消",
};

export function ToolCallBubble({
  icon: ToolIcon = ToolboxIcon,
  name,
  state,
}: ToolCallBubbleProps) {
  const finished = state === "output-available";
  const failed = state === "output-error";
  const denied = state === "output-denied";
  const active = !finished && !failed && !denied;
  const ResultIcon = finished
    ? CheckIcon
    : failed
      ? WarningCircleIcon
      : denied
        ? XIcon
        : null;

  return (
    <article
      aria-busy={active}
      aria-label={`${name}：${stateLabel[state]}`}
      className={[
        "ds-button-secondary",
        "ds-tool-call-bubble",
        active ? "ds-button-loading" : "",
      ].join(" ")}
      data-state={state}
      role="status"
    >
      <span className="ds-tool-call-icon">
        <ToolIcon aria-hidden="true" size={15} weight="bold" />
      </span>
      <strong className="ds-tool-call-name">{name}</strong>
      {ResultIcon ? (
        <span aria-hidden="true" className="ds-tool-call-result">
          <ResultIcon size={12} weight="bold" />
        </span>
      ) : null}
    </article>
  );
}
