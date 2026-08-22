/**
 * [INPUT]: 依赖 React effect/state、鉴权 memo-search API、轻量目录树与查询词
 * [OUTPUT]: 对外提供经 180ms 防抖、可取消且按 active tree 过滤的正文命中 ID 集合
 * [POS]: widgets 层普通关键词搜索控制器；只传输命中 ID/摘要，不加载或缓存任何完整正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useState } from "react";

import { searchMemos } from "../shared/api/memo";
import { findNode } from "../shared/store/memoTree";
import type { MemoTreeNode } from "../shared/api/memo";

const SEARCH_DEBOUNCE_MS = 180;

export function useMemoSearch(
  accessToken: string,
  tree: readonly MemoTreeNode[],
  query: string,
  limit = 50,
): ReadonlySet<string> {
  const [bodyHitIds, setBodyHitIds] = useState<readonly string[]>([]);
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (normalizedQuery.length === 0) {
      setBodyHitIds([]);
      return;
    }
    setBodyHitIds([]);
    let active = true;
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      void searchMemos(accessToken, normalizedQuery, controller.signal, limit)
        .then((hits) => {
          if (!active) return;
          setBodyHitIds(
            hits.flatMap((hit) => findNode(tree, hit.node_id) === null ? [] : [hit.node_id]),
          );
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (active) setBodyHitIds([]);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [accessToken, limit, normalizedQuery, tree]);

  return useMemo(() => new Set(bodyHitIds), [bodyHitIds]);
}
