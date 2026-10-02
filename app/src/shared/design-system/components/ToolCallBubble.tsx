/**
 * [INPUT]: 依赖 Collapse/React 状态、共享图标、人话名称/详情、可选界面语言文案和 AI SDK/执行器状态
 * [OUTPUT]: 对外提供不暴露原始载荷、固定状态位仅 running 展示单弧旋转，等待静止，完成展示成功/失败、有详情才可聚焦展开的 ToolCallBubble
 * [POS]: design-system AI 消息家族的工具披露控件，以 Secondary Button 同源材质承载动作入口，详情保持普通信息排版
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Collapse } from "./Collapse";
import {
  CheckCircleIcon,
  ToolboxIcon,
  XCircleIcon,
  type Icon,
} from "../icons";
import { useId, useState } from "react";

export type ToolCallState =
  | "queued"
  | "running"
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolCallDetail = {
  label: string;
  value: string;
};

type ToolCallBubbleProps = {
  details?: readonly ToolCallDetail[];
  icon?: Icon;
  live?: boolean;
  name: string;
  state: ToolCallState;
  labels?: { states: Record<ToolCallState, string>; interrupted: string; details: string };
};

const stateLabel: Record<ToolCallState, string> = {
  queued: "等待执行",
  running: "正在执行",
  "input-streaming": "正在准备",
  "input-available": "等待执行",
  "approval-requested": "等待确认",
  "approval-responded": "等待执行",
  "output-available": "调用完成",
  "output-error": "调用失败",
  "output-denied": "已取消",
};

export function ToolCallBubble({
  details = [],
  icon: ToolIcon = ToolboxIcon,
  live = true,
  name,
  state,
  labels,
}: ToolCallBubbleProps) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const finished = state === "output-available";
  const failed = state === "output-error";
  const denied = state === "output-denied";
  const pending = !finished && !failed && !denied;
  const interrupted = pending && !live;
  const active = state === "running" && live;
  const expandable = details.length > 0;
  const ResultIcon = finished
    ? CheckCircleIcon
    : failed || denied || interrupted
      ? XCircleIcon
      : null;
  const status = interrupted ? labels?.interrupted ?? "未完成" : (labels?.states ?? stateLabel)[state];
  const bubbleClassName = "ds-button-secondary ds-tool-call-bubble";
  const bubbleContent = (
    <>
      <span className="ds-tool-call-icon">
        <ToolIcon aria-hidden="true" size={14} />
      </span>
      <strong className="ds-tool-call-name">{name}</strong>
      <span aria-hidden="true" className="ds-tool-call-result" data-result={finished ? "success" : active ? "pending" : pending && live ? "waiting" : "failure"}>
        {ResultIcon ? <ResultIcon size={16} /> : active ? (
          <svg className="ds-tool-spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" pathLength="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : <span className="ds-tool-waiting" />}
      </span>
    </>
  );

  return (
    <div
      className="ds-tool-call-disclosure"
      data-state={state}
    >
      {expandable ? (
        <button
          aria-busy={active || undefined}
          aria-controls={detailsId}
          aria-expanded={expanded}
          aria-label={labels ? `${name}: ${status}, ${labels.details}` : `${name}：${status}，查看详情`}
          className={bubbleClassName}
          data-expandable="true"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {bubbleContent}
        </button>
      ) : (
        <div
          aria-busy={active || undefined}
          aria-label={labels ? `${name}: ${status}` : `${name}：${status}`}
          className={bubbleClassName}
          data-expandable="false"
          role="status"
        >
          {bubbleContent}
        </div>
      )}
      {expandable ? (
        <Collapse open={expanded}>
        <dl
          className="ds-tool-call-details"
          id={detailsId}
        >
          {details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
        </Collapse>
      ) : null}
    </div>
  );
}
