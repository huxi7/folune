/**
 * [INPUT]: 依赖 React Router navigate、用户/access token、memoTreeStore 同步乐观创建、稀疏排序、纸张聚焦回调、删除后目的地与 Toast
 * [OUTPUT]: 对外提供 useOptimisticMemoCreation；同步选择临时纸张，独立跟踪并发提交，仅已实际选中的创建可替换真实路由或失败回退
 * [POS]: app/src/pages 的创建路由协调器；把临时/真实 ID、last-memo 与乱序响应边界从 AppDashboard 拆出，Store 仍独占树事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useLayoutEffect, useRef } from "react";
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
  onCreatedMemo: (memoClientKey: string) => void;
  onSelectMemo: (memoId: string) => void;
  onTitleDraftReset: () => void;
  routeMemoId: string | null;
  toast: (input: ToastInput) => void;
};

export function useOptimisticMemoCreation({
  accessToken,
  lastMemoStorageKey,
  navigate,
  onCreatedMemo,
  onSelectMemo,
  onTitleDraftReset,
  routeMemoId,
  toast,
}: UseOptimisticMemoCreationInput) {
  const currentRouteMemoIdRef = useRef(routeMemoId);
  // 只跟踪已提交选择；等待 Canvas 安全保存期间，创建回包不得提前导航离开。
  useLayoutEffect(() => {
    currentRouteMemoIdRef.current = routeMemoId;
  }, [routeMemoId]);

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

          if (currentRouteMemoIdRef.current === optimisticId) {
            currentRouteMemoIdRef.current = created.id;
            navigate(`/app/notes/${encodeURIComponent(created.id)}`, {
              flushSync: true,
              replace: true,
            });
          }

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

            navigate(destination.path, { flushSync: true, replace: true });
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
    onCreatedMemo,
    onSelectMemo,
    onTitleDraftReset,
    toast,
  ]);
}
