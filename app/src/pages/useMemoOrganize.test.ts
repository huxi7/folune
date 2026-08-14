/**
 * [INPUT]: 依赖 Bun test、AiRun 最小夹具与 useMemoOrganize/Dashboard 的 Run 展示纯决策
 * [OUTPUT]: 覆盖成功/撤销唤醒与目标快照、待确认唤醒 AI、stale/失败/过程态清除归档展示
 * [POS]: pages 层整理舞台分流回归测试，不启动 React、网络或真实 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  buildWorkspaceOrganizePresentation,
  getOrganizeWakeTarget,
  shouldPresentOrganizeResult,
} from "./organizePresentation";
import type { AiRun } from "../shared/api/ai";

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

  test("成功连接新目录，撤销连接恢复后的真实目录", () => {
    expect(buildWorkspaceOrganizePresentation({
      resolveMemoPath: () => "ignored",
      run: succeededRun,
      selectedMemoId: "memo-1",
    })).toMatchObject({
      path: "New / Quiet systems",
      status: "succeeded",
      targetFolderId: "folder-new",
    });

    expect(buildWorkspaceOrganizePresentation({
      resolveMemoPath: () => "Restored / Quiet systems",
      run: {
        ...succeededRun,
        id: "run-undo",
        status: "undone",
        result: {
          ...succeededRun.result!,
          undo: {
            memo: memo("folder-restored"),
            removed_folder_id: null,
            folder_retained: true,
          },
        },
      },
      selectedMemoId: "memo-1",
    })).toMatchObject({
      path: "Restored / Quiet systems",
      status: "undone",
      targetFolderId: "folder-restored",
    });
  });

  test("stale 与非当前 memo 不产生归档快照", () => {
    expect(buildWorkspaceOrganizePresentation({
      resolveMemoPath: () => "ignored",
      run: { ...succeededRun, status: "stale" },
      selectedMemoId: "memo-1",
    })).toBeNull();
    expect(buildWorkspaceOrganizePresentation({
      resolveMemoPath: () => "ignored",
      run: succeededRun,
      selectedMemoId: "memo-2",
    })).toBeNull();
  });
});
