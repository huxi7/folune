/**
 * [INPUT]: 依赖 AiRun 状态/结果、当前 memo tree、WorkspaceOrganizePresentation 与 memoLibrary 的路径/查找
 * [OUTPUT]: 对外提供整理 Run 的工具唤醒、成功展示门禁、OrganizePresentationRun 载体及按当前树重算的归档快照构造
 * [POS]: app/src/pages 的整理表现策略边界；隔离业务 Hook/Dashboard 与无副作用测试。路径与存在性一律从当前树重推，run 快照只用来证明这条 presentation 为什么存在，不用来回答 memo 现在在哪
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRun, AiRunStatus } from "../shared/api/ai";
import type { MemoTreeNode } from "../shared/api/memo";
import type { WorkspaceOrganizePresentation } from "../widgets/archiveCordPolicy";
import { findMemoNode, getMemoFolderPath } from "../widgets/memoLibrary";

/**
 * 一个待展示的整理结果，附带它是「刚刚发生」还是「本来就为真」。
 * 刷新后重新取回同一次 run 不是新的语义事件，因此它必须以 restored 进来，
 * 否则每次刷新都会重播一遍成功动效 —— 那是在把事实伪装成事件。
 */
export type OrganizePresentationRun = {
  origin: "fresh" | "restored";
  run: AiRun;
};

export const getOrganizeWakeTarget = (
  status: AiRunStatus,
): "assistant" | "library" | null => {
  if (status === "awaiting_confirmation") return "assistant";
  if (status === "succeeded" || status === "undone") return "library";
  return null;
};

export const shouldPresentOrganizeResult = (
  status: AiRunStatus,
): status is "succeeded" | "undone" => status === "succeeded"
  || status === "undone";

export const buildWorkspaceOrganizePresentation = ({
  memoTree,
  presentation,
  selectedMemoId,
}: {
  memoTree: readonly MemoTreeNode[];
  presentation: OrganizePresentationRun | null;
  selectedMemoId: string | null;
}): WorkspaceOrganizePresentation | null => {
  if (presentation === null) return null;

  const { origin, run } = presentation;
  const result = run.result;
  const status = run.status;
  if (result === null || !shouldPresentOrganizeResult(status)) {
    return null;
  }

  const resultMemo = status === "undone" ? result.undo?.memo : result.memo;
  if (resultMemo === undefined || resultMemo.id !== selectedMemoId) {
    return null;
  }

  /*
   * memo 已不在 active tree（被删除、被移进回收站）就是语义级清除:
   * 关系的一端消失了, 剩下的不是一条低对比的线, 而是没有关系。
   */
  if (findMemoNode(memoTree, resultMemo.id) === null) {
    return null;
  }

  return {
    memoId: resultMemo.id,
    origin,
    // run.result.target_path 是那一刻的快照; memo 之后被移动过, 它就开始撒谎
    path: getMemoFolderPath(memoTree, resultMemo.id),
    runId: run.id,
    status,
  };
};
