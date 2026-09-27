/**
 * [INPUT]: 依赖批量检查点写入器、恢复候选判定与可控持久化
 * [OUTPUT]: 验证并行批次串行落库不覆盖、恢复范围与停止终态门禁
 * [POS]: AgentPanel 批量恢复的数据完整性测试，不调用网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import type { FoluneUIMessage } from "../../shared/api/ai";
import { createBatchCheckpointer } from "./batchCheckpoint";
import { findRecoverableTools } from "./batchRecovery";

const tool = (id: string) => ({ type: "dynamic-tool" as const, toolName: "edit_nodes", toolCallId: id, input: {}, state: "input-available" as const });

test("两个批次检查点串行合并最新消息，工具结果与另一批记录不丢失", async () => {
  let messages: FoluneUIMessage[] = [{ id: "a", role: "assistant", parts: [tool("one"), tool("two")] }];
  const saved: FoluneUIMessage[] = [];
  let release!: () => void;
  const checkpoint = createBatchCheckpointer({ read: () => messages, write: (next) => { messages = next; }, persist: async (message) => {
    saved.push(message);
    if (saved.length === 1) await new Promise<void>((resolve) => { release = resolve; });
  } });
  const one = checkpoint("one", { kind: "memo-batch", items: [] });
  const two = checkpoint("two", { kind: "memo-batch", items: [] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(saved).toHaveLength(1);
  messages = [{ ...messages[0]!, parts: messages[0]!.parts.map((part) => "toolCallId" in part && part.toolCallId === "one" ? { ...tool("one"), state: "output-available", output: {} } : part) }];
  release();
  await Promise.all([one, two]);
  expect(saved[1]!.parts.filter((part) => part.type === "data-tool-batch")).toHaveLength(2);
  expect(saved[1]!.parts[0]).toMatchObject({ state: "output-available" });
});

test("仅恢复最后一轮已有检查点的未完成工具，终态和历史消息不重新执行", () => {
  const message: FoluneUIMessage = { id: "a", role: "assistant", parts: [tool("one"), tool("two"), { type: "data-tool-batch", id: "one", data: { kind: "memo-batch", items: [] } }] };
  expect(findRecoverableTools([message]).map((part) => part.toolCallId)).toEqual(["one"]);
  expect(findRecoverableTools([message, { id: "u", role: "user", parts: [{ type: "text", text: "下一轮" }] }])).toHaveLength(0);
  expect(findRecoverableTools([{ ...message, parts: [{ ...tool("one"), state: "output-available", output: {} }, message.parts[2]!] }])).toHaveLength(0);
});
