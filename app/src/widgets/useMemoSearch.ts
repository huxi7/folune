/**
 * [INPUT]: 依赖 React effect/state、鉴权 memo-search API、轻量目录树与查询词
 * [OUTPUT]: 对外提供经 180ms 防抖、可取消、按 active tree 过滤的正文命中 ID 集合与 idle/loading/ready/error 状态
 * [POS]: widgets 层关键词搜索控制器；请求只随查询变化，树更新只重做本地过滤，先建立一次节点 ID 索引再过滤命中，避免命中数乘树大小的重复查找；状态如实区分加载与失败
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useState } from "react";

import { searchMemos } from "../shared/api/memo";
import type { MemoTreeNode } from "../shared/api/memo";

const SEARCH_DEBOUNCE_MS = 180;

export type MemoSearchStatus = "error" | "idle" | "loading" | "ready";

export type MemoSearchState = {
  bodyHitIds: ReadonlySet<string>;
  status: MemoSearchStatus;
};

const collectNodeIds = (tree: readonly MemoTreeNode[]): ReadonlySet<string> => {
  const ids = new Set<string>();
  const pending = [...tree];

  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    ids.add(node.id);
    for (const child of node.children) pending.push(child);
  }

  return ids;
};

export function useMemoSearch(
  accessToken: string,
  tree: readonly MemoTreeNode[],
  query: string,
  limit = 50,
): MemoSearchState {
  const [bodyHitIds, setBodyHitIds] = useState<readonly string[]>([]);
  const [status, setStatus] = useState<MemoSearchStatus>("idle");
  const normalizedQuery = query.trim();
  const treeNodeIds = useMemo(() => collectNodeIds(tree), [tree]);

  useEffect(() => {
    if (normalizedQuery.length === 0) {
      setBodyHitIds([]);
      setStatus("idle");
      return;
    }
    setBodyHitIds([]);
    setStatus("loading");
    let active = true;
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      void searchMemos(accessToken, normalizedQuery, controller.signal, limit)
        .then((hits) => {
          if (!active) return;
          setBodyHitIds(hits.map((hit) => hit.node_id));
          setStatus("ready");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!active) return;
          setBodyHitIds([]);
          // 正文检索失败不影响已经在屏幕上的标题/路径结果, 只如实标记状态
          setStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [accessToken, limit, normalizedQuery]);

  return useMemo(
    () => ({ bodyHitIds: new Set(bodyHitIds.filter((id) => treeNodeIds.has(id))), status }),
    [bodyHitIds, status, treeNodeIds],
  );
}
