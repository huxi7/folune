/**
 * [INPUT]: 依赖轻量 MemoTreeNode、当前笔记身份、访问令牌、workspacePreload 网络策略与 memoDocumentStore 的意图预取命令
 * [OUTPUT]: 对外提供在浏览器空闲期预热当前笔记相邻正文的 useMemoDocumentPreload
 * [POS]: pages 的按需加载加速边界；正文就绪后只预取相邻两篇，离线/省流/慢网/后台页跳过，不扩大目录载荷或改变路由选择
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo } from "react";

import type { MemoTreeNode } from "../shared/api/memo";
import { useMemoDocumentStore } from "../shared/store/memoDocumentStore";
import { canPreloadWorkspace } from "./workspacePreload";

const memoIdsInReadingOrder = (
  nodes: readonly MemoTreeNode[],
  result: string[] = [],
): string[] => {
  for (const node of nodes) {
    if (node.node_type === "memo") result.push(node.id);
    if (node.children.length > 0) memoIdsInReadingOrder(node.children, result);
  }
  return result;
};

export function useMemoDocumentPreload(input: {
  accessToken: string;
  enabled: boolean;
  memoId: string | null;
  tree: readonly MemoTreeNode[];
}) {
  const preloadMemo = useMemoDocumentStore((state) => state.preloadMemo);
  const readingOrder = useMemo(
    () => memoIdsInReadingOrder(input.tree),
    [input.tree],
  );

  useEffect(() => {
    if (!input.enabled || input.memoId === null) return;
    const index = readingOrder.indexOf(input.memoId);
    if (index < 0) return;

    const candidates = [readingOrder[index - 1], readingOrder[index + 1]]
      .filter((memoId): memoId is string => memoId !== undefined);
    if (candidates.length === 0) return;

    const warm = () => {
      if (!canPreloadWorkspace()) return;
      for (const memoId of candidates) {
        void preloadMemo(input.accessToken, memoId).catch(() => undefined);
      }
    };
    const requestIdle = window.requestIdleCallback?.bind(window);
    if (requestIdle !== undefined) {
      const idleId = requestIdle(warm, { timeout: 800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(warm, 120);
    return () => window.clearTimeout(timerId);
  }, [input.accessToken, input.enabled, input.memoId, preloadMemo, readingOrder]);
}
