/**
 * [INPUT]: 依赖 shared/api/memo 的轻量 MemoTreeNode（canvas 节点携带 MemoCanvasIdentity）与服务端正文命中 ID
 * [OUTPUT]: 对外提供 CommandResult/CommandMatch 类型、buildCommandResults 排序纯函数与 recentCommandResults 空查询列表
 * [POS]: app/src/widgets 的全局搜索唯一排序与去重真相；Command Palette 只消费结果，任何组件都不得再自己排一遍。默认画布在此降级为其来源笔记行上的次级动作，只有独立画布是独立结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../shared/api/memo";

export type CommandResultKind = "canvas" | "folder" | "memo";

/** 命中档位即排序档位，序号就是优先级 */
export type CommandMatch =
  | "title-exact"
  | "title-prefix"
  | "recent"
  | "title-contains"
  | "body"
  | "path";

export type CommandResult = {
  /** memo 行的次级动作「以画布打开」；没有默认画布时为 null */
  defaultCanvasId: string | null;
  id: string;
  kind: CommandResultKind;
  match: CommandMatch;
  path: string;
  revision: number;
  title: string;
};

const MATCH_ORDER: readonly CommandMatch[] = [
  "title-exact",
  "title-prefix",
  "recent",
  "title-contains",
  "body",
  "path",
];

const DEFAULT_LIMIT = 40;
const ROOT_PATH = "根目录";

export const normalizeCommandQuery = (query: string): string =>
  query.trim().replaceAll(/\s+/gu, " ").toLocaleLowerCase();

type FlatNode = {
  kind: CommandResultKind;
  node: MemoTreeNode;
  path: string;
};

const flatten = (
  nodes: readonly MemoTreeNode[],
  folders: readonly string[],
  out: FlatNode[],
): FlatNode[] => {
  for (const node of nodes) {
    const path = folders.length === 0 ? ROOT_PATH : folders.join(" / ");
    if (node.node_type === "folder") {
      out.push({ kind: "folder", node, path });
      flatten(node.children, [...folders, node.title], out);
      continue;
    }
    out.push({
      kind: node.node_type === "canvas" ? "canvas" : "memo",
      node,
      path,
    });
  }
  return out;
};

/** memo id → 它的默认画布 id */
const defaultCanvasByOrigin = (flat: readonly FlatNode[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const entry of flat) {
    const origin = entry.node.canvas?.origin_node_id ?? null;
    if (entry.kind === "canvas" && origin !== null) map.set(origin, entry.node.id);
  }
  return map;
};

/**
 * 默认画布与来源笔记同名，所以它绝不能成为独立结果——否则搜一个词会返回两行
 * 完全一样的条目。它降级为那篇笔记行上的「以画布打开」。
 */
const isDefaultCanvas = (entry: FlatNode): boolean =>
  entry.kind === "canvas" && (entry.node.canvas?.origin_node_id ?? null) !== null;

const matchOf = (
  entry: FlatNode,
  query: string,
  bodyHits: ReadonlySet<string>,
  recentIndex: Map<string, number>,
): CommandMatch | null => {
  const title = entry.node.title.toLocaleLowerCase();
  if (title === query) return "title-exact";
  if (title.startsWith(query)) return "title-prefix";
  const titleContains = title.includes(query);
  const bodyHit = entry.kind === "memo" && bodyHits.has(entry.node.id);
  const pathHit = entry.path.toLocaleLowerCase().includes(query);
  if (!titleContains && !bodyHit && !pathHit) return null;
  // 最近打开的对象只要命中就整档提前：用户刚看过的东西比字面位置更重要
  if (recentIndex.has(entry.node.id)) return "recent";
  if (titleContains) return "title-contains";
  return bodyHit ? "body" : "path";
};

const toResult = (
  entry: FlatNode,
  match: CommandMatch,
  defaultCanvases: Map<string, string>,
): CommandResult => ({
  defaultCanvasId: entry.kind === "memo"
    ? defaultCanvases.get(entry.node.id) ?? null
    : null,
  id: entry.node.id,
  kind: entry.kind,
  match,
  path: entry.path,
  revision: entry.node.revision,
  title: entry.node.title,
});

const compare = (
  left: CommandResult,
  right: CommandResult,
  recentIndex: Map<string, number>,
): number =>
  MATCH_ORDER.indexOf(left.match) - MATCH_ORDER.indexOf(right.match)
  || (recentIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (recentIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  || left.title.length - right.title.length
  || left.title.localeCompare(right.title)
  || left.id.localeCompare(right.id);

export const buildCommandResults = (input: {
  bodyHitIds?: readonly string[];
  limit?: number;
  query: string;
  recentIds?: readonly string[];
  tree: readonly MemoTreeNode[];
}): CommandResult[] => {
  const query = normalizeCommandQuery(input.query);
  if (query.length === 0) return [];

  const flat = flatten(input.tree, [], []);
  const defaultCanvases = defaultCanvasByOrigin(flat);
  const bodyHits = new Set(input.bodyHitIds ?? []);
  const recentIndex = new Map(
    (input.recentIds ?? []).map((id, index) => [id, index]),
  );
  const results: CommandResult[] = [];

  for (const entry of flat) {
    if (isDefaultCanvas(entry)) continue;
    const match = matchOf(entry, query, bodyHits, recentIndex);
    if (match !== null) results.push(toResult(entry, match, defaultCanvases));
  }

  return results
    .sort((left, right) => compare(left, right, recentIndex))
    .slice(0, input.limit ?? DEFAULT_LIMIT);
};

/** 空查询时列最近打开的笔记与独立画布，顺序就是最近顺序 */
export const recentCommandResults = (input: {
  limit?: number;
  recentIds: readonly string[];
  tree: readonly MemoTreeNode[];
}): CommandResult[] => {
  const flat = flatten(input.tree, [], []);
  const defaultCanvases = defaultCanvasByOrigin(flat);
  const byId = new Map(flat.map((entry) => [entry.node.id, entry]));
  const results: CommandResult[] = [];

  for (const id of input.recentIds) {
    const entry = byId.get(id);
    if (entry === undefined || entry.kind === "folder") continue;
    if (isDefaultCanvas(entry)) continue;
    results.push(toResult(entry, "recent", defaultCanvases));
    if (results.length >= (input.limit ?? 8)) break;
  }

  return results;
};
