/**
 * [INPUT]: 依赖 Bun test、独立审批协调纯函数与 memo 胖工具公共契约
 * [OUTPUT]: 验证模型只看到四个工具、稳定审批缓存键及三档权限的 fail-closed 人工确认规则
 * [POS]: tools 子域执行面守门测试，防止内部细分 command 再次泄漏给模型或非法审批绕过人工门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  buildWriteApprovalPayload,
  shouldRequireManualApproval,
} from "@/lib/approval-coordinator";
import {
  approvalDecisionKey,
  memoClientTools,
  resolveMemoWriteToolName,
  WRITE_MEMO_TOOL_NAMES,
} from "./memo";

describe("memo server tool contracts", () => {
  test("exposes only four memo tools and one fat node writer", () => {
    expect(Object.keys(memoClientTools).sort()).toEqual([
      "edit_memo",
      "edit_node",
      "read_memo",
      "read_tree",
    ]);
    expect([...WRITE_MEMO_TOOL_NAMES].sort()).toEqual(["edit_memo", "edit_node"]);
  });

  test("creates a stable approval cache key independent of object key order", () => {
    expect(approvalDecisionKey("edit_node", {
      op: "move",
      node_id: "a",
      parent_id: null,
      expected_revision: 3,
    })).toBe(approvalDecisionKey("edit_node", {
      expected_revision: 3,
      parent_id: null,
      node_id: "a",
      op: "move",
    }));
  });

  test("fails closed for ask, uncertain and missing approval decisions", () => {
    const approved = { decision: "approve", risk: "low", reason: "目标明确" } as const;
    const manual = { decision: "manual", risk: "medium", reason: "需要判断" } as const;

    expect(shouldRequireManualApproval("ask", approved)).toBeTrue();
    expect(shouldRequireManualApproval("auto_approve", approved)).toBeFalse();
    expect(shouldRequireManualApproval("auto_approve", manual)).toBeTrue();
    expect(shouldRequireManualApproval("auto_approve", undefined)).toBeTrue();
    expect(shouldRequireManualApproval("full_access", undefined)).toBeFalse();
  });

  test("feeds intent, sources, actual target, parameters and impact to experimental approval", () => {
    expect(buildWriteApprovalPayload("edit_node", {
      expected_revision: 3,
      node_id: "node-a",
      op: "delete",
    }, {
      primaryTitle: "项目计划",
      referenceTitles: ["风险清单"],
      userRequest: "删除这份废弃草稿",
      target: {
        affected_node_count: 4,
        parent_title: "草稿",
        target_title: "废弃方案",
        target_type: "folder",
      },
    })).toEqual({
      input: { expected_revision: 3, node_id: "node-a", op: "delete" },
      tool: "edit_node",
      turn: {
        primary_title: "项目计划",
        reference_titles: ["风险清单"],
        target: {
          affected_node_count: 4,
          parent_title: "草稿",
          target_title: "废弃方案",
          target_type: "folder",
        },
        user_request: "删除这份废弃草稿",
      },
    });
  });

  test("recognizes namespaced write tools before applying approval", () => {
    expect(resolveMemoWriteToolName("edit_node")).toBe("edit_node");
    expect(resolveMemoWriteToolName("memo.edit_node")).toBe("edit_node");
    expect(resolveMemoWriteToolName("memo:edit_memo")).toBe("edit_memo");
    expect(resolveMemoWriteToolName("create_node")).toBeNull();
    expect(resolveMemoWriteToolName("celebration")).toBeNull();
  });
});
