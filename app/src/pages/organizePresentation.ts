/**
 * [INPUT]: 依赖 AiRun 状态/结果、WorkspaceOrganizePresentation 与调用方提供的当前目录路径解析
 * [OUTPUT]: 对外提供整理 Run 的工具唤醒、成功展示门禁及 succeeded/undone 归档快照构造纯决策
 * [POS]: app/src/pages 的整理表现策略边界；隔离业务 Hook/Dashboard 与无副作用测试，确保失败/stale 不唤醒工具、撤销只指向恢复位置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRun, AiRunStatus } from "../shared/api/ai";
import type { WorkspaceOrganizePresentation } from "../widgets/archiveCordPolicy";

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
  resolveMemoPath,
  run,
  selectedMemoId,
}: {
  resolveMemoPath: (memoId: string) => string;
  run: AiRun | null;
  selectedMemoId: string | null;
}): WorkspaceOrganizePresentation | null => {
  if (
    run === null
    || run.result === null
    || !shouldPresentOrganizeResult(run.status)
  ) {
    return null;
  }

  const resultMemo = run.status === "undone"
    ? run.result.undo?.memo
    : run.result.memo;
  if (resultMemo === undefined || resultMemo.id !== selectedMemoId) {
    return null;
  }

  return {
    memoId: resultMemo.id,
    path: run.status === "undone"
      ? resolveMemoPath(resultMemo.id)
      : run.result.target_path,
    runId: run.id,
    status: run.status,
    targetFolderId: resultMemo.parent_id,
  };
};
