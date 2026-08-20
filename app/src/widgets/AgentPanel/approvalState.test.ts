/**
 * [INPUT]: 依赖 Bun test、AI SDK 动态工具 part 与 approvalState 纯函数
 * [OUTPUT]: 覆盖审批只响应一次、拒绝不恢复、批准刷新可恢复及结果落地后不再恢复
 * [POS]: AgentPanel 审批状态机回归测试，锁定重复弹出与刷新重问的核心防线
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { SuperNoteUIMessage } from "../../shared/api/ai";
import {
  applyApprovalResponse,
  applyToolOutput,
  findApprovedPendingTools,
  findPendingApproval,
} from "./approvalState";

const approvalMessage = (): SuperNoteUIMessage => ({
  id: "assistant-1",
  parts: [{
    approval: { id: "approval-1" },
    input: { node_id: "memo-1", op: "delete" },
    state: "approval-requested",
    toolCallId: "tool-1",
    toolName: "edit_node",
    type: "dynamic-tool",
  }],
  role: "assistant",
});

describe("approvalState", () => {
  test("同一个 approval 只从 requested 响应一次", () => {
    const initial = [approvalMessage()];
    const approved = applyApprovalResponse(initial, "approval-1", true);

    expect(approved).toBeDefined();
    expect(findPendingApproval(approved ?? [])).toBeUndefined();
    expect(applyApprovalResponse(approved ?? [], "approval-1", true)).toBeUndefined();
  });

  test("批准后的未完成工具可在刷新后恢复，结果落地后不再恢复", () => {
    const approved = applyApprovalResponse([approvalMessage()], "approval-1", true) ?? [];
    expect(findApprovedPendingTools(approved).map((part) => part.toolCallId)).toEqual(["tool-1"]);

    const completed = applyToolOutput(approved, "tool-1", {
      output: { id: "command-1", status: "succeeded" },
      state: "output-available",
    }) ?? [];
    expect(findApprovedPendingTools(completed)).toEqual([]);
  });

  test("拒绝结果不会成为刷新恢复候选", () => {
    const denied = applyApprovalResponse([approvalMessage()], "approval-1", false) ?? [];
    expect(findPendingApproval(denied)).toBeUndefined();
    expect(findApprovedPendingTools(denied)).toEqual([]);
  });
});
