/**
 * [INPUT]: 依赖 React Router navigate、用户/access token、memoTreeStore 的同步乐观创建事务、稀疏排序算法、删除后目的地纯函数与全局 Toast
 * [OUTPUT]: 对外提供 useOptimisticMemoCreation；一次点击同步插入并进入临时备忘录，独立跟踪并发提交，成功原位换成真实路由，失败只回退对应当前项
 * [POS]: app/src/pages 的创建路由协调器；把临时/真实 ID、last-memo 与乱序响应边界从 AppDashboard 拆出，Store 仍独占树事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useRef } from "react";
import type { NavigateFunction } from "react-router-dom";

import type { ToastInput } from "../shared/design-system/components";
import { findSiblings, prependSortOrder } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { getPostDeletionDestination } from "./memoDeletion";

const DEFAULT_MEMO_TITLE = "未命名备忘录";

type UseOptimisticMemoCreationInput = {
  accessToken: string;
  lastMemoStorageKey: string;
  navigate: NavigateFunction;
  onSelectMemo: (memoId: string) => void;
  onTitleDraftReset: () => void;
  routeMemoId: string | null;
  toast: (input: ToastInput) => void;
};

export function useOptimisticMemoCreation({
  accessToken,
  lastMemoStorageKey,
  navigate,
  onSelectMemo,
  onTitleDraftReset,
  routeMemoId,
  toast,
}: UseOptimisticMemoCreationInput) {
  const currentRouteMemoIdRef = useRef(routeMemoId);
  currentRouteMemoIdRef.current = routeMemoId;

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
      currentRouteMemoIdRef.current = optimisticId;
      onSelectMemo(optimisticId);

      void committed
        .then((created) => {
          if (window.localStorage.getItem(lastMemoStorageKey) === optimisticId) {
            window.localStorage.setItem(lastMemoStorageKey, created.id);
          }

          if (currentRouteMemoIdRef.current === optimisticId) {
            currentRouteMemoIdRef.current = created.id;
            navigate(`/app/notes/${encodeURIComponent(created.id)}`, {
              replace: true,
            });
          }

          toast({ title: "备忘录已创建", variant: "success" });
        })
        .catch((error) => {
          if (window.localStorage.getItem(lastMemoStorageKey) === optimisticId) {
            window.localStorage.removeItem(lastMemoStorageKey);
          }

          if (currentRouteMemoIdRef.current === optimisticId) {
            const destination = getPostDeletionDestination(
              useMemoTreeStore.getState().nodes,
            );
            currentRouteMemoIdRef.current = destination.memoId;
            onTitleDraftReset();

            if (destination.memoId !== null) {
              window.localStorage.setItem(
                lastMemoStorageKey,
                destination.memoId,
              );
            }

            navigate(destination.path, { replace: true });
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
    navigate,
    onSelectMemo,
    onTitleDraftReset,
    toast,
  ]);
}
