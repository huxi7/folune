/**
 * [INPUT]: 依赖 React effect/state、鉴权 memo-search API、轻量目录树与查询词
 * [OUTPUT]: 对外提供经 180ms 防抖、可取消、按 active tree 过滤的正文命中 ID 集合与 idle/loading/ready/error 状态
 * [POS]: widgets 层普通关键词搜索控制器；只传输命中 ID/摘要，不加载或缓存任何完整正文；状态由此如实上报，Command Palette 才能把"正在补入正文结果"和"正文搜索失败"分开表达而不是一律显示空
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useState } from "react";

import { searchMemos } from "../shared/api/memo";
import { findNode } from "../shared/store/memoTree";
import type { MemoTreeNode } from "../shared/api/memo";

const SEARCH_DEBOUNCE_MS = 180;

export type MemoSearchStatus = "error" | "idle" | "loading" | "ready";

export type MemoSearchState = {
  bodyHitIds: ReadonlySet<string>;
  status: MemoSearchStatus;
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
          setBodyHitIds(
            hits.flatMap((hit) => findNode(tree, hit.node_id) === null ? [] : [hit.node_id]),
          );
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
  }, [accessToken, limit, normalizedQuery, tree]);

  return useMemo(
    () => ({ bodyHitIds: new Set(bodyHitIds), status }),
    [bodyHitIds, status],
  );
}
