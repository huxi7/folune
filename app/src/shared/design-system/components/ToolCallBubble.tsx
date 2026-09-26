/**
 * [INPUT]: 依赖 Collapse 的按需高度披露、 React 折叠状态、共享 Lucide 工具图标与自带圆形轮廓的结果图标、人话名称/详情与 AI SDK 调用状态
 * [OUTPUT]: 对外提供不暴露原始载荷、固定状态位展示转圈/成功/失败、有详情才可聚焦展开的 ToolCallBubble
 * [POS]: design-system AI 消息家族的工具披露控件，以 Secondary Button 同源材质承载动作入口，详情保持普通信息排版
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Collapse } from "./Collapse";
import {
  CheckCircleIcon,
  ToolboxIcon,
  CircleNotchIcon,
  XCircleIcon,
  type Icon,
} from "../icons";
import { useId, useState } from "react";

export type ToolCallState =
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
  details = [],
  icon: ToolIcon = ToolboxIcon,
  live = true,
  name,
  state,
}: ToolCallBubbleProps) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const finished = state === "output-available";
  const failed = state === "output-error";
  const denied = state === "output-denied";
  const pending = !finished && !failed && !denied;
  const interrupted = pending && !live;
  const active = pending && live;
  const expandable = details.length > 0;
  const ResultIcon = finished
    ? CheckCircleIcon
    : failed || denied || interrupted
      ? XCircleIcon
      : CircleNotchIcon;
  const status = interrupted ? "未完成" : stateLabel[state];
  const bubbleClassName = "ds-button-secondary ds-tool-call-bubble";
  const bubbleContent = (
    <>
      <span className="ds-tool-call-icon">
        <ToolIcon aria-hidden="true" size={14} />
      </span>
      <strong className="ds-tool-call-name">{name}</strong>
      <span aria-hidden="true" className="ds-tool-call-result" data-result={finished ? "success" : active ? "pending" : "failure"}>
        <ResultIcon className={active ? "ds-button-spinner" : undefined} size={16} />
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
          aria-label={`${name}：${status}，查看详情`}
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
          aria-label={`${name}：${status}`}
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
