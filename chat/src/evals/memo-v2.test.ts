/**
 * [INPUT]: 依赖 Bun test、30 条 Memo V2 任务集与指标聚合器
 * [OUTPUT]: 验证任务数、唯一性、写操作 revision 场景覆盖和五项指标边界
 * [POS]: evals 的静态质量门；模型回放前先保证评测协议本身稳定、完整且可统计
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { memoV2EvalCases, scoreMemoV2Evaluation } from "./memo-v2";

describe("Memo V2 evaluation baseline", () => {
  test("固定为 30 条不重复的真实任务", () => {
    expect(memoV2EvalCases).toHaveLength(30);
    expect(new Set(memoV2EvalCases.map((item) => item.id)).size).toBe(30);
  });

  test("覆盖三档权限、胖工具五种 op、stale 与 undo", () => {
    expect(new Set(memoV2EvalCases.map((item) => item.permissionMode))).toEqual(
      new Set(["ask", "auto_approve", "full_access"]),
    );
    expect(new Set(memoV2EvalCases.map((item) => item.expectedTool))).toEqual(
      new Set(["none", "read_tree", "read_memo", "edit_node", "edit_memo"]),
    );
    expect(new Set(memoV2EvalCases.flatMap((item) => item.expectedNodeOp ?? []))).toEqual(
      new Set(["create", "rename", "move", "reorder", "delete"]),
    );
    expect(memoV2EvalCases.some((item) => item.expectedResult === "stale")).toBe(true);
    expect(memoV2EvalCases.some((item) => item.expectedResult === "undone")).toBe(true);
  });

  test("聚合五项验收指标", () => {
    expect(scoreMemoV2Evaluation([
      { contextHit: true, chosenTool: "edit_memo", expectedTool: "edit_memo", manualConfirmation: false, status: "succeeded", undoAttempted: true, undoSucceeded: true },
      { contextHit: false, chosenTool: "none", expectedTool: "edit_node", manualConfirmation: true, status: "stale", undoAttempted: false, undoSucceeded: false },
    ])).toEqual({
      context_hit_rate: 0.5,
      wrong_tool_rate: 0.5,
      manual_confirmation_rate: 0.5,
      stale_rate: 0.5,
      undo_success_rate: 1,
    });
  });
});
