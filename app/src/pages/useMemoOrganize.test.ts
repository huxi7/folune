/**
 * [INPUT]: 依赖 Bun test、AiRun 与 MemoTreeNode 最小夹具、useMemoOrganize/Dashboard 的 Run 展示纯决策
 * [OUTPUT]: 覆盖成功/撤销唤醒、按当前树重算路径、fresh 与 restored 的 origin 透传、memo 被移动/删除后的表现，以及 stale/失败/非当前 memo 不产生归档展示
 * [POS]: pages 层整理舞台分流回归测试，不启动 React、网络或真实 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  buildWorkspaceOrganizePresentation,
  getOrganizeWakeTarget,
  shouldPresentOrganizeResult,
  type OrganizePresentationRun,
} from "./organizePresentation";
import type { AiRun } from "../shared/api/ai";
import type { MemoTreeNode } from "../shared/api/memo";

const now = "2026-08-14T00:00:00.000Z";
const memo = (parentId: string | null) => ({
  id: "memo-1",
  user_id: "user-1",
  parent_id: parentId,
  node_type: "memo" as const,
  title: "Quiet systems",
  sort_order: "1000",
  icon: null,
  color: null,
  metadata: {},
  revision: 2,
  deleted_at: null,
  deleted_root_id: null,
  created_at: now,
  updated_at: now,
});

const succeededRun: AiRun = {
  id: "run-1",
  user_id: "user-1",
  thread_id: null,
  memo_id: "memo-1",
  source_revision: 1,
  status: "succeeded",
  idempotency_key: "organize-1",
  plan: null,
  result: {
    result_revision: 2,
    memo: memo("folder-new"),
    created_folder: null,
    target_path: "New / Quiet systems",
  },
  error_code: null,
  created_at: now,
  updated_at: now,
  applied_at: now,
  undone_at: null,
};

const treeNode = (
  id: string,
  nodeType: "folder" | "memo",
  parentId: string | null,
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  ...memo(parentId),
  children,
  id,
  memo: nodeType === "memo"
    ? {
      created_at: now,
      excerpt: null,
      metadata: {},
      node_id: id,
      updated_at: now,
      user_id: "user-1",
      word_count: 0,
    }
    : null,
  node_type: nodeType,
  title: id,
});

/** memo-1 现在真实住在 New 下；run 快照说的是那一刻，树说的是现在 */
const currentTree: MemoTreeNode[] = [
  treeNode("folder-new", "folder", null, [treeNode("memo-1", "memo", "folder-new")]),
];
const movedTree: MemoTreeNode[] = [
  treeNode("folder-later", "folder", null, [
    treeNode("folder-deeper", "folder", "folder-later", [
      treeNode("memo-1", "memo", "folder-deeper"),
    ]),
  ]),
];
const fresh = (run: AiRun): OrganizePresentationRun => ({ origin: "fresh", run });

describe("AI organize workspace wake target", () => {
  test("成功与撤销只唤醒文件库", () => {
    expect(getOrganizeWakeTarget("succeeded")).toBe("library");
    expect(getOrganizeWakeTarget("undone")).toBe("library");
    expect(shouldPresentOrganizeResult("succeeded")).toBe(true);
    expect(shouldPresentOrganizeResult("undone")).toBe(true);
  });

  test("只有待确认方案唤醒 AI", () => {
    expect(getOrganizeWakeTarget("awaiting_confirmation")).toBe("assistant");
  });

  test("stale、失败和过程态不强迫用户进入工具", () => {
    expect(getOrganizeWakeTarget("stale")).toBeNull();
    expect(getOrganizeWakeTarget("failed")).toBeNull();
    expect(getOrganizeWakeTarget("planning")).toBeNull();
    expect(getOrganizeWakeTarget("applying")).toBeNull();
    expect(getOrganizeWakeTarget("rejected")).toBeNull();
    expect(shouldPresentOrganizeResult("stale")).toBe(false);
    expect(shouldPresentOrganizeResult("failed")).toBe(false);
    expect(shouldPresentOrganizeResult("planning")).toBe(false);
    expect(shouldPresentOrganizeResult("applying")).toBe(false);
    expect(shouldPresentOrganizeResult("rejected")).toBe(false);
  });

  test("canonical 目标恒为 memo，成功与撤销都按当前树给路径", () => {
    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: fresh(succeededRun),
      selectedMemoId: "memo-1",
    })).toEqual({
      memoId: "memo-1",
      origin: "fresh",
      path: "folder-new",
      runId: "run-1",
      status: "succeeded",
    });

    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: fresh({
        ...succeededRun,
        id: "run-undo",
        status: "undone",
        result: {
          ...succeededRun.result!,
          undo: {
            memo: memo("folder-new"),
            removed_folder_id: null,
            folder_retained: true,
          },
        },
      }),
      selectedMemoId: "memo-1",
    })).toMatchObject({
      memoId: "memo-1",
      path: "folder-new",
      status: "undone",
    });
  });

  test("memo 被移动后路径跟随现在的真实位置，run 快照不再作为落点来源", () => {
    // run.result.target_path 仍是 "New / Quiet systems"，但 memo 已经被搬走了
    expect(buildWorkspaceOrganizePresentation({
      memoTree: movedTree,
      presentation: fresh(succeededRun),
      selectedMemoId: "memo-1",
    })?.path).toBe("folder-later / folder-deeper");
  });

  test("origin 原样透传：刷新恢复的同一次 run 必须是 restored", () => {
    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: { origin: "restored", run: succeededRun },
      selectedMemoId: "memo-1",
    })?.origin).toBe("restored");
  });

  test("根级 memo 得到稳定人话落点", () => {
    expect(buildWorkspaceOrganizePresentation({
      memoTree: [treeNode("memo-1", "memo", null)],
      presentation: fresh(succeededRun),
      selectedMemoId: "memo-1",
    })?.path).toBe("根目录");
  });

  test("无 presentation、stale、非当前 memo 与 memo 已不在树中都不产生归档快照", () => {
    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: null,
      selectedMemoId: "memo-1",
    })).toBeNull();
    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: fresh({ ...succeededRun, status: "stale" }),
      selectedMemoId: "memo-1",
    })).toBeNull();
    expect(buildWorkspaceOrganizePresentation({
      memoTree: currentTree,
      presentation: fresh(succeededRun),
      selectedMemoId: "memo-2",
    })).toBeNull();
    // memo 被删除是语义级清除，不是「一条低对比的线」
    expect(buildWorkspaceOrganizePresentation({
      memoTree: [treeNode("folder-new", "folder", null)],
      presentation: fresh(succeededRun),
      selectedMemoId: "memo-1",
    })).toBeNull();
  });
});
