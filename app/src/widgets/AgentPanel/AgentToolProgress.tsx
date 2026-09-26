/**
 * [INPUT]: 依赖消息有序过程 parts、按真实结果生成的工具展示与 DS ToolCallBubble
 * [OUTPUT]: 对外提供有界工具进度与按需展开记录；推理原文仅留在消息协议，不进入 DOM/Markdown
 * [POS]: AgentPanel 过程展示边界；数量来自去重工具状态，不依赖模型数数，批量默认最多挂载六个胶囊
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isToolUIPart, type UIMessage } from "ai";
import { useState } from "react";
import { ToolCallBubble } from "../../shared/design-system/components";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { getAgentToolState, type AgentToolPresentation } from "./toolPresentation";

const PREVIEW_COUNT = 6;
const PAGE_SIZE = 20;

type Props = {
  parts: UIMessage["parts"];
  presentations: Map<string, AgentToolPresentation>;
  live: boolean;
};

export function AgentToolProgress({ parts, presentations, live }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const tools = parts.filter(isToolUIPart);
  const completed = tools.filter((part) => getAgentToolState(part) === "output-available").length;
  const failed = tools.filter((part) => getAgentToolState(part) === "output-error" || getAgentToolState(part) === "output-denied").length;
  const pending = tools.filter((part) => getAgentToolState(part) !== "output-available" && getAgentToolState(part) !== "output-error" && getAgentToolState(part) !== "output-denied");
  const batch = tools.length > PREVIEW_COUNT;
  // 当前待执行项优先，剩余位置给最近结果；历史回看由用户显式分页展开。
  const preview: typeof tools = pending.slice(0, PREVIEW_COUNT);
  for (const part of [...tools].reverse()) {
    if (preview.length >= PREVIEW_COUNT) break;
    if (!preview.includes(part)) preview.push(part);
  }
  const visibleIds = new Set((visibleCount > 0 ? tools.slice(0, visibleCount) : preview).map((part) => part.toolCallId));
  const visibleParts = parts.filter((part) => part.type !== "reasoning"
    && (!batch || (isToolUIPart(part) && visibleIds.has(part.toolCallId))));

  return <>
    {batch ? <div className="agent-tool-progress" role="status">
      已完成 {completed} / {tools.length} 项{failed > 0 ? ` · ${failed} 项未完成` : ""}
      {!live && pending.length > 0 ? ` · ${pending.length} 项已停止` : ""}
    </div> : null}
    {tools.length === 0 && !live && parts.some((part) => part.type === "reasoning")
      ? <div className="agent-tool-progress">分析已结束</div> : null}
    {visibleParts.map((part, index) => {
      if (part.type === "text") return <div className="agent-process-text" data-kind="text" key={`text-${index}`}><MarkdownReadingView content={part.text} /></div>;
      if (!isToolUIPart(part)) return null;
      const presentation = presentations.get(part.toolCallId)!;
      return <div className="agent-tool-stack" key={part.toolCallId}>
        <ToolCallBubble details={presentation.details} icon={presentation.icon} live={live} name={presentation.name} state={getAgentToolState(part)} />
      </div>;
    })}
    {batch && visibleCount < tools.length ? <button className="agent-tool-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
      {visibleCount === 0 ? `查看全部 ${tools.length} 项操作` : "显示更多操作"}
    </button> : null}
    {visibleCount > 0 ? <button className="agent-tool-more" type="button" onClick={() => setVisibleCount(0)}>收起操作记录</button> : null}
  </>;
}
