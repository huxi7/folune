/**
 * [INPUT]: 依赖模型消息投影与 UIMessage fixtures
 * [OUTPUT]: 验证推理不变、完整 UI 消息不变、检查点不进模型、批量结果保留真实状态
 * [POS]: Chat 批量上下文体积与结果真实性门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { batchModelMessages } from "./batch-model-messages";

test("模型只接收批量结果，完整记录仍保留在原始消息", () => {
  const messages: UIMessage[] = [{ id: "a", role: "assistant", parts: [
    { type: "reasoning", text: "原始推理保留" },
    { type: "data-tool-batch", id: "b", data: { internal: "checkpoint" } },
    { type: "dynamic-tool", toolName: "edit_nodes", toolCallId: "b", input: {}, state: "output-available", output: { kind: "memo-batch", items: [
      { plan: { nodeId: "a" }, state: "succeeded", output: { before_state: "large" } },
      { plan: { nodeId: "b" }, state: "failed", output: { error_code: "STALE" }, error: "版本变化" },
      { plan: { nodeId: "c" }, state: "cancelled" },
    ] } },
  ] }];
  const result = batchModelMessages(messages);
  expect(result[0]!.parts).toHaveLength(2);
  expect(result[0]!.parts[0]).toEqual(messages[0]!.parts[0]);
  expect(result[0]!.parts[1]).toMatchObject({ output: { total: 3, succeeded: 1, results: [{ node_id: "a", status: "succeeded" }, { node_id: "b", status: "failed", error_code: "STALE" }, { node_id: "c", status: "cancelled" }] } });
  expect(messages[0]!.parts).toHaveLength(3);
  expect(JSON.stringify(result)).not.toContain("before_state");
});
