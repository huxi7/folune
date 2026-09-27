/**
 * [INPUT]: 依赖持久化 UIMessage 里的批量工具结果与本地恢复检查点
 * [OUTPUT]: 提供仅面向模型的消息投影；删除内部检查点，批量回包只保留目标与实际状态
 * [POS]: Chat 模型上下文边界；完整命令/撤销快照仍由原始 UIMessage 持久化，不产生额外模型请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getToolName, isToolUIPart, type UIMessage } from "ai";

export function batchModelMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({ ...message, parts: message.parts.flatMap((part): UIMessage["parts"] => {
    if (part.type === "data-tool-batch") return [];
    if (!isToolUIPart(part) || getToolName(part).split(/[.:/]/u).at(-1) !== "edit_nodes" || part.state !== "output-available") return [part];
    const output = part.output as { kind?: string; items?: Array<{ state?: string; plan?: { nodeId?: string }; output?: { error_code?: string }; error?: string }> } | undefined;
    if (output?.kind !== "memo-batch" || !Array.isArray(output.items)) return [part];
    const results = output.items.map((item) => ({ node_id: item.plan?.nodeId, status: item.state, ...(item.error ? { error: item.error } : {}), ...(item.output?.error_code ? { error_code: item.output.error_code } : {}) }));
    return [{ ...part, output: { total: results.length, succeeded: results.filter((result) => result.status === "succeeded").length, results } }];
  }) }));
}
