/**
 * [INPUT]: 依赖即时选择/身份对账回调、用户/access token、memoTreeStore 同步乐观创建、稀疏排序、纸张聚焦回调、按原槽位就近回退的删除落点与 Toast
 * [OUTPUT]: 对外提供 useOptimisticMemoCreation；同步创建并选择临时笔记，独立跟踪并发提交；选中意图边界负责身份对账和失败回退，不强制执行正文导航
 * [POS]: app/src/pages 的创建路由协调器；把临时/真实 ID、last-memo 与乱序响应边界从 AppDashboard 拆出，Store 仍独占树事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback } from "react";

import type { ToastInput } from "../shared/design-system/components";
import { findSiblings, prependSortOrder } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { getPostDeletionDestination } from "./memoDeletion";

const DEFAULT_MEMO_TITLE = "未命名备忘录";

type UseOptimisticMemoCreationInput = {
  accessToken: string;
  lastMemoStorageKey: string;
  onReconcileSelection: (optimisticId: string, replacementId: string | null) => boolean;
  onCreatedMemo: (memoClientKey: string) => void;
  onSelectMemo: (memoId: string) => void;
  onTitleDraftReset: () => void;
  toast: (input: ToastInput) => void;
};

export function useOptimisticMemoCreation({
  accessToken,
  lastMemoStorageKey,
  onReconcileSelection,
  onCreatedMemo,
  onSelectMemo,
  onTitleDraftReset,
  toast,
}: UseOptimisticMemoCreationInput) {
  return useCallback((parentId: string | null) => {
    try {
      const store = useMemoTreeStore.getState();
      const siblings = findSiblings(store.nodes, parentId) ?? [];
      const { committed, optimistic } = store.beginCreateMemo(accessToken, {
        content_mdx: "",
        parent_id: parentId,
        sort_order: prependSortOrder(siblings),
        title: DEFAULT_MEMO_TITLE,
      });
      const optimisticId = optimistic.id;
      window.localStorage.setItem(lastMemoStorageKey, optimisticId);
      onSelectMemo(optimisticId);
      onCreatedMemo(optimisticId);

      void committed
        .then((created) => {
          if (window.localStorage.getItem(lastMemoStorageKey) === optimisticId) {
            window.localStorage.setItem(lastMemoStorageKey, created.id);
          }

          onReconcileSelection(optimisticId, created.id);

        })
        .catch((error) => {
          if (window.localStorage.getItem(lastMemoStorageKey) === optimisticId) {
            window.localStorage.removeItem(lastMemoStorageKey);
          }

          // 临时笔记插在同级最前，撤回后就近落到它原来那一格的邻居，而不是树顶
          const destination = getPostDeletionDestination(
            useMemoTreeStore.getState().nodes,
            { index: 0, parentId },
          );
          if (onReconcileSelection(optimisticId, destination.memoId)) {
            onTitleDraftReset();
            if (destination.memoId !== null) window.localStorage.setItem(lastMemoStorageKey, destination.memoId);
          }

          toast({
            description: error instanceof Error ? error.message : undefined,
            title: "新建备忘录失败，已撤销",
            variant: "error",
          });
        });
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "新建备忘录失败",
        variant: "error",
      });
    }
  }, [
    accessToken,
    lastMemoStorageKey,
    onReconcileSelection,
    onCreatedMemo,
    onSelectMemo,
    onTitleDraftReset,
    toast,
  ]);
}
