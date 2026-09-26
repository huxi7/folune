/**
 * [INPUT]: 依赖 memoDeletion 的影响面/移除前槽位/就近落点纯策略、memoTreeStore 软删命令、memoDocumentStore 正文清理、NotesWorkspace 的 required flush handle、调用方共享的 mutating 门禁、last-memo 存储键、Router 导航与全局 Toast
 * [OUTPUT]: 对外提供软删命令 deleteNode，成功时返回 true
 * [POS]: AppDashboard 的删除编排 Hook；删除前可证明当前编辑会话已落库；乐观移除与导航落在同一批次、网络确认放到其后，使删除当前笔记时路由从被删项直接跳到同一位置的相邻笔记、不经过空态那一帧也不被甩回树顶；失败则随回滚原路退回并恢复编辑会话
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
  getMemoTreeSlot,
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
    // 删除当前路由要在同一批次里从被删笔记跳到落点; 失败要能原路退回
    const originalPath = window.location.pathname;
    let navigatedAway = false;
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

      /*
       * softDeleteNode 会先同步把节点从树里摘掉，再 await 网络。若像从前那样
       * 先 await 再导航，被删笔记已从树上消失、路由却还没切走，整段网络时间都
       * 停在 memo===null 的空态上——这正是「每删一篇都闪一下」的根因。所以不
       * await 它：让同步的乐观移除与 navigate 落在同一个 React 批次里，路由从
       * 被删笔记直接跳到落点，中间不经过空态。网络确认放到最后，只用于回滚。
       *
       * 槽位必须在摘除之前取：摘掉之后树里只剩空位，落点才能就近而不是回到树顶。
       */
      const slot = getMemoTreeSlot(useMemoTreeStore.getState().nodes, nodeId);
      const deletion = softDeleteNode(accessToken, nodeId);

      const storedMemoId = window.localStorage.getItem(lastMemoStorageKey);

      if (storedMemoId !== null && impact.affectedMemoIds.has(storedMemoId)) {
        window.localStorage.removeItem(lastMemoStorageKey);
      }

      if (impact.affectsCurrentRoute) {
        const destination = getPostDeletionDestination(
          useMemoTreeStore.getState().nodes,
          slot,
        );

        onLeaveRoute();

        if (destination.memoId !== null) {
          window.localStorage.setItem(lastMemoStorageKey, destination.memoId);
        }

        navigate(destination.path, { replace: true });
        navigatedAway = true;
      }

      await deletion;

      // 网络已确认成功才清正文缓存：失败时缓存尚在，原路退回可秒开被删笔记
      removeMemoDocuments(impact.affectedMemoIds);
      onDeleted();
      toast({ title: "已移至回收站", variant: "success" });
      return true;
    } catch (error) {
      // softDeleteNode 失败时已把节点插回树；把用户原路送回，界面恢复原状
      if (navigatedAway) {
        navigate(originalPath, { replace: true });
      }

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
