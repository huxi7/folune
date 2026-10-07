/**
 * [INPUT]: 依赖有序过程 parts、locale 读屏状态、工具展示适配、执行事实订阅与明确批量快照
 * [OUTPUT]: 服务端画布只读工具按真实输入和输出展示执行状态； 原始推理和普通工具原序展示，只有明确批量请求可折叠；转圈数量完全来自真实执行状态
 * [POS]: AgentPanel 过程展示边界；不做摘要、工具同名猜测或全局数量裁剪
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { ToolCallBubble } from "../../shared/design-system/components";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { BatchToolProgress } from "./BatchToolProgress";
import { englishToolStateLabels, getAgentToolState, normalizeAgentToolName, type AgentToolPresentation } from "./toolPresentation";
import { readBatchSnapshot, useToolExecution } from "./toolExecutionState";
import { useLocale } from "../../shared/locale";

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;
function ToolProgress({ part, presentation, live, checkpoint }: { part: ToolPart; presentation: AgentToolPresentation; live: boolean; checkpoint?: unknown }) {
  const { locale } = useLocale();
  const execution = useToolExecution(part.toolCallId);
  const batch = readBatchSnapshot(part.output) ?? execution?.batch ?? readBatchSnapshot(checkpoint);
  if (normalizeAgentToolName(getToolName(part)) === "edit_nodes" && batch) return <BatchToolProgress batch={batch} live={live} />;
  const sdkState = getAgentToolState(part);
  const terminal = sdkState.startsWith("output-");
  const serverTool = ["list_sources", "read_relations", "read_text", "read_source", "cite_sources"].includes(normalizeAgentToolName(getToolName(part)));
  const state = terminal ? sdkState : serverTool && sdkState === "input-available" ? "running" : execution?.state === "running" ? "running"
    : execution?.state === "succeeded" ? "output-available" : execution?.state === "failed" ? "output-error"
    : execution?.state === "cancelled" ? "output-denied" : sdkState === "input-available" ? "queued" : sdkState;
  return <div className="agent-tool-stack"><ToolCallBubble {...presentation} labels={locale === "en" ? englishToolStateLabels : undefined} live={live} state={state} /></div>;
}

export function AgentToolProgress({ parts, presentations, live }: {
  parts: UIMessage["parts"]; presentations: Map<string, AgentToolPresentation>; live: boolean;
}) {
  const checkpoints = new Map(parts.filter((part) => part.type === "data-tool-batch").map((part) => ["id" in part ? part.id : undefined, "data" in part ? part.data : undefined]));
  return <>{parts.map((part, index) => {
    if (part.type === "reasoning") return part.text ? <div className="agent-process-text agent-process-reasoning" data-kind="reasoning" key={`reasoning-${index}`}><p>{part.text}</p></div> : null;
    if (part.type === "text") return <div className="agent-process-text" data-kind="text" key={`text-${index}`}><MarkdownReadingView content={part.text} /></div>;
    if (!isToolUIPart(part)) return null;
    return <ToolProgress key={part.toolCallId} part={part} presentation={presentations.get(part.toolCallId)!} live={live} checkpoint={checkpoints.get(part.toolCallId)} />;
  })}</>;
}
