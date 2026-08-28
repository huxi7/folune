/**
 * [INPUT]: 依赖 memoDeletion 的影响面/落点纯策略、memoTreeStore 软删命令、memoDocumentStore 正文清理、NotesWorkspace 的 required flush handle、调用方共享的 mutating 门禁、last-memo 存储键、Router 导航与全局 Toast
 * [OUTPUT]: 对外提供软删命令 deleteNode，成功时返回 true
 * [POS]: AppDashboard 的删除编排 Hook；删除前可证明当前编辑会话已落库，删除后收拾正文缓存、last-memo 记录与路由，失败则恢复编辑会话并保留原状
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";

import type { ToastInput } from "../shared/design-system/components";
import { useMemoDocumentStore } from "../shared/store/memoDocumentStore";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import type { NotesWorkspaceHandle } from "../widgets/NotesWorkspace";
import {
  getMemoDeletionImpact,
  getPostDeletionDestination,
} from "./memoDeletion";

type UseMemoNodeDeletionInput = {
  accessToken: string;
  /** 当前编辑会话边界；画布没有编辑器，故允许为 null */
  editingSession: React.RefObject<NotesWorkspaceHandle | null>;
  lastMemoStorageKey: string;
  /** 与其他树事务共享的并发门禁，避免两套「正在改树」状态 */
  mutating: boolean;
  navigate: NavigateFunction;
  /** 删除成功后的副作用：刷新回收站计数 */
  onDeleted: () => void;
  /** 即将离开当前路由：清理页面级草稿并回到笔记视图 */
  onLeaveRoute: () => void;
  /** 当前路由上的节点 id，可能是临时 id */
  routeNodeId: string | null;
  setMutating: (value: boolean) => void;
  toast: (input: ToastInput) => void;
};

export function useMemoNodeDeletion({
  accessToken,
  editingSession,
  lastMemoStorageKey,
  mutating,
  navigate,
  onDeleted,
  onLeaveRoute,
  routeNodeId,
  setMutating,
  toast,
}: UseMemoNodeDeletionInput) {
  const softDeleteNode = useMemoTreeStore((state) => state.softDeleteNode);
  const removeMemoDocuments = useMemoDocumentStore((state) => state.removeMemos);

  const deleteNode = useCallback(async (nodeId: string): Promise<boolean> => {
    if (mutating) return false;

    const impact = getMemoDeletionImpact(
      useMemoTreeStore.getState().nodes,
      nodeId,
      routeNodeId,
    );

    if (impact === null) {
      toast({ title: "要删除的项目不存在", variant: "error" });
      return false;
    }

    let autosavePaused = false;
    setMutating(true);

    try {
      /*
       * 「需要 flush」与「需要导航离开」是两件事：画布没有编辑会话，删除正在
       * 打开的画布只导航不 flush，不得因为拿不到编辑器而静默失败。
       */
      if (impact.affectsCurrentMemo) {
        const boundary = editingSession.current;

        if (boundary === null) {
          throw new Error("编辑会话尚未准备好，请稍后重试。");
        }

        await boundary.prepareForDelete();
        autosavePaused = true;
      }

      await softDeleteNode(accessToken, nodeId);
      removeMemoDocuments(impact.affectedMemoIds);

      const storedMemoId = window.localStorage.getItem(lastMemoStorageKey);

      if (storedMemoId !== null && impact.affectedMemoIds.has(storedMemoId)) {
        window.localStorage.removeItem(lastMemoStorageKey);
      }

      onDeleted();

      if (impact.affectsCurrentRoute) {
        const destination = getPostDeletionDestination(
          useMemoTreeStore.getState().nodes,
        );

        onLeaveRoute();

        if (destination.memoId !== null) {
          window.localStorage.setItem(lastMemoStorageKey, destination.memoId);
        }

        navigate(destination.path, { replace: true });
      }

      toast({ title: "已移至回收站", variant: "success" });
      return true;
    } catch (error) {
      if (autosavePaused) {
        editingSession.current?.resumeAfterDeleteFailure();
      }

      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "移至回收站失败",
        variant: "error",
      });
      return false;
    } finally {
      setMutating(false);
    }
  }, [
    accessToken,
    editingSession,
    lastMemoStorageKey,
    mutating,
    navigate,
    onDeleted,
    onLeaveRoute,
    removeMemoDocuments,
    routeNodeId,
    setMutating,
    softDeleteNode,
    toast,
  ]);

  return { deleteNode };
}
