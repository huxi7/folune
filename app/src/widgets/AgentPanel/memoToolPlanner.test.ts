/**
 * [INPUT]: 依赖 Bun test、MemoTreeNode fixture 与 Worker 纯规划内核
 * [OUTPUT]: 验证整树读取、五种 edit_node op、edit_memo、revision 和非法移动约束
 * [POS]: AgentPanel Worker Planner 回归测试，锁定胖工具到内部原子命令计划的完整语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../../shared/api/memo";
import { planMemoTool } from "./memoToolPlanner";

const TIME = "2026-08-09T00:00:00.000Z";
const USER_ID = "00000000-0000-4000-8000-000000000099";
const FOLDER_ID = "00000000-0000-4000-8000-000000000001";
const MEMO_A_ID = "00000000-0000-4000-8000-000000000002";
const MEMO_B_ID = "00000000-0000-4000-8000-000000000003";

const makeNode = (
  id: string,
  nodeType: "folder" | "memo",
  parentId: string | null,
  sortOrder: string,
  title: string,
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: nodeType === "memo"
    ? {
        created_at: TIME,
        excerpt: title,
        metadata: {},
        node_id: id,
        updated_at: TIME,
        user_id: USER_ID,
        word_count: 1,
      }
    : null,
  metadata: {},
  node_type: nodeType,
  parent_id: parentId,
  revision: 1,
  sort_order: sortOrder,
  title,
  updated_at: TIME,
  user_id: USER_ID,
});

const tree = [
  makeNode(FOLDER_ID, "folder", null, "1000", "读书", [
    makeNode(MEMO_A_ID, "memo", FOLDER_ID, "1000", "影响力"),
    makeNode(MEMO_B_ID, "memo", FOLDER_ID, "2000", "设计心理学"),
  ]),
];

describe("memo tool Worker planner", () => {
  test("projects the complete tree in path order", () => {
    const plan = planMemoTool("read_tree", {}, tree);

    expect(plan.kind).toBe("read_tree");
    if (plan.kind !== "read_tree") return;
    expect(plan.output.total).toBe(3);
    expect(plan.output.nodes.map((node) => node.path)).toEqual([
      "读书",
      "读书 / 影响力",
      "读书 / 设计心理学",
    ]);
  });

  test("turns create memo into one Store command", () => {
    const plan = planMemoTool("edit_node", {
      content_mdx: "读完《影响力》第三章",
      node_type: "memo",
      op: "create",
      parent_id: FOLDER_ID,
      title: "读完《影响力》第三章",
    }, tree);

    expect(plan).toEqual({
      input: {
        content_mdx: "读完《影响力》第三章",
        parent_id: FOLDER_ID,
        title: "读完《影响力》第三章",
      },
      kind: "create_memo",
      op: "create",
    });
  });

  test("computes append order for move and sparse order for reorder", () => {
    const movePlan = planMemoTool("edit_node", {
      node_id: MEMO_A_ID,
      expected_revision: 1,
      op: "move",
      parent_id: null,
    }, tree);
    expect(movePlan).toMatchObject({
      input: { parent_id: null, sort_order: "2000" },
      kind: "move_node",
      nodeId: MEMO_A_ID,
      op: "move",
    });

    const reorderPlan = planMemoTool("edit_node", {
      node_id: MEMO_B_ID,
      expected_revision: 1,
      op: "reorder",
      placement: "before",
      reference_node_id: MEMO_A_ID,
    }, tree);
    expect(reorderPlan).toMatchObject({
      input: { parent_id: FOLDER_ID, sort_order: "500" },
      kind: "move_node",
      nodeId: MEMO_B_ID,
      op: "reorder",
    });
  });

  test("plans rename and soft delete with frozen revisions", () => {
    expect(planMemoTool("edit_node", {
      expected_revision: 1,
      node_id: MEMO_A_ID,
      op: "rename",
      title: "影响力读书笔记",
    }, tree)).toMatchObject({
      expectedRevision: 1,
      kind: "rename_node",
      nodeId: MEMO_A_ID,
      op: "rename",
      title: "影响力读书笔记",
    });
    expect(planMemoTool("edit_node", {
      expected_revision: 1,
      node_id: MEMO_A_ID,
      op: "delete",
    }, tree)).toEqual({
      expectedRevision: 1,
      kind: "delete_node",
      nodeId: MEMO_A_ID,
      op: "delete",
    });
  });

  test("plans memo edits and rejects a stale Worker snapshot", () => {
    expect(planMemoTool("edit_memo", {
      content_mdx: "更新后的正文",
      expected_revision: 1,
      node_id: MEMO_A_ID,
    }, tree)).toMatchObject({
      contentMdx: "更新后的正文",
      expectedRevision: 1,
      kind: "edit_memo",
      nodeId: MEMO_A_ID,
    });
    expect(() => planMemoTool("edit_node", {
      expected_revision: 2,
      node_id: MEMO_A_ID,
      op: "delete",
    }, tree)).toThrow("节点版本已变化");
  });

  test("reads memo content and rejects cross-folder reorder", () => {
    const readPlan = planMemoTool("read_memo", { node_id: MEMO_A_ID }, tree);
    expect(readPlan).toMatchObject({
      kind: "read_memo",
      nodeId: MEMO_A_ID,
    });

    expect(() => planMemoTool("edit_node", {
      node_id: MEMO_A_ID,
      expected_revision: 1,
      op: "reorder",
      placement: "before",
      reference_node_id: FOLDER_ID,
    }, tree)).toThrow("reorder 只能在同一父目录内执行");
  });
});
