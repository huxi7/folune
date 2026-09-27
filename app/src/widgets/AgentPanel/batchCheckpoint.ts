/**
 * [INPUT]: 依赖最新消息引用、SDK 消息更新、既有单条消息同步与批量快照
 * [OUTPUT]: 提供串行批量检查点写入器，保留同消息其他批次与工具结果，不把运行进度发布成最终工具输出
 * [POS]: AgentPanel 批量持久化边界；序列化保存而不串行化业务执行，供刷新恢复与停止回看
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { FoluneUIMessage } from "../../shared/api/ai";
import { isToolUIPart } from "ai";
import type { BatchSnapshot } from "./toolExecutionState";

export function createBatchCheckpointer(options: {
  read: () => FoluneUIMessage[];
  write: (messages: FoluneUIMessage[]) => void;
  persist: (message: FoluneUIMessage) => Promise<unknown>;
}) {
  let saving = Promise.resolve();
  return (callId: string, batch: BatchSnapshot) => {
    const save = saving.catch(() => undefined).then(async () => {
      const current = options.read();
      const index = current.findLastIndex((message) => message.parts.some((part) => isToolUIPart(part) && part.toolCallId === callId));
      if (index < 0) throw new Error("批量任务记录尚未就绪，请重新发送。");
      const message = current[index]!;
      const updated = { ...message, parts: [...message.parts.filter((part) => !(part.type === "data-tool-batch" && part.id === callId)), { type: "data-tool-batch" as const, id: callId, data: batch }] };
      options.write(current.map((message, i) => i === index ? updated : message));
      await options.persist(updated);
    });
    saving = save;
    return save;
  };
}
