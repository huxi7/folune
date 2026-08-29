/**
 * [INPUT]: 依赖 shared/api/memo 的轻量 MemoTreeNode（canvas 节点携带 MemoCanvasIdentity）与服务端正文命中 ID
 * [OUTPUT]: 对外提供 CommandResult/CommandMatch 类型、buildCommandResults 排序纯函数与 recentCommandResults 空查询列表
 * [POS]: app/src/widgets 的全局搜索唯一排序真相；Command Palette 只消费结果，任何组件都不得再自己排一遍。两种画布都是独立结果行，同名时笔记恒排在它的画布之前，血缘由 originTitle 说明而不由缺席表达
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
  /** memo 行的次级动作「以画布打开」（Tab）；没有默认画布时为 null */
  defaultCanvasId: string | null;
  id: string;
  kind: CommandResultKind;
  match: CommandMatch;
  /** 画布行的来源笔记标题；独立画布与非画布为 null */
  originTitle: string | null;
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

/**
 * 血缘索引。两个方向各建一次: 笔记行要知道自己有没有画布（决定 Tab 能不能按），
 * 画布行要知道自己从哪篇笔记长出来（决定副标题写什么）。
 *
 * 默认画布出生时抄了来源笔记的标题，因此搜一个词可能返回两行同名条目——这是
 * 有意的: 它们是两个能去的地方，不是一个东西的两种写法。辨识交给图标与血缘
 * 副标题，不靠把画布藏起来。
 */
type TreeIndex = {
  /** memo id → 它的默认画布 id */
  defaultCanvasByOrigin: Map<string, string>;
  /** memo id → 标题 */
  memoTitleById: Map<string, string>;
};

const indexTree = (flat: readonly FlatNode[]): TreeIndex => {
  const index: TreeIndex = {
    defaultCanvasByOrigin: new Map(),
    memoTitleById: new Map(),
  };
  for (const entry of flat) {
    if (entry.kind === "memo") {
      index.memoTitleById.set(entry.node.id, entry.node.title);
      continue;
    }
    const origin = entry.node.canvas?.origin_node_id ?? null;
    if (entry.kind === "canvas" && origin !== null) {
      index.defaultCanvasByOrigin.set(origin, entry.node.id);
    }
  }
  return index;
};

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

const originTitleOf = (entry: FlatNode, index: TreeIndex): string | null => {
  if (entry.kind !== "canvas") return null;
  const originId = entry.node.canvas?.origin_node_id ?? null;
  return originId === null ? null : index.memoTitleById.get(originId) ?? null;
};

const toResult = (
  entry: FlatNode,
  match: CommandMatch,
  index: TreeIndex,
): CommandResult => ({
  defaultCanvasId: entry.kind === "memo"
    ? index.defaultCanvasByOrigin.get(entry.node.id) ?? null
    : null,
  id: entry.node.id,
  kind: entry.kind,
  match,
  originTitle: originTitleOf(entry, index),
  path: entry.path,
  revision: entry.node.revision,
  title: entry.node.title,
});

/*
 * 同档、同标题时的最后一道确定性: 笔记先于画布先于文件夹。默认画布与来源笔记
 * 同名是常态, 若落到按 UUID 比较, 谁在前面就成了随机的——用户会觉得列表在抖。
 * 本体先于派生物, 因此笔记恒在它的画布之前。
 */
const KIND_RANK: Readonly<Record<CommandResultKind, number>> = {
  canvas: 1,
  folder: 2,
  memo: 0,
};

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
  || KIND_RANK[left.kind] - KIND_RANK[right.kind]
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
  const index = indexTree(flat);
  const bodyHits = new Set(input.bodyHitIds ?? []);
  const recentIndex = new Map(
    (input.recentIds ?? []).map((id, position) => [id, position]),
  );
  const results: CommandResult[] = [];

  for (const entry of flat) {
    const match = matchOf(entry, query, bodyHits, recentIndex);
    if (match !== null) results.push(toResult(entry, match, index));
  }

  return results
    .sort((left, right) => compare(left, right, recentIndex))
    .slice(0, input.limit ?? DEFAULT_LIMIT);
};

/**
 * 空查询时列最近打开的笔记与画布，顺序就是最近顺序。默认画布也在其中: 在一张
 * 画布上做了一小时事之后, 它必须是"刚打开过的东西"。
 */
export const recentCommandResults = (input: {
  limit?: number;
  recentIds: readonly string[];
  tree: readonly MemoTreeNode[];
}): CommandResult[] => {
  const flat = flatten(input.tree, [], []);
  const index = indexTree(flat);
  const byId = new Map(flat.map((entry) => [entry.node.id, entry]));
  const results: CommandResult[] = [];

  for (const id of input.recentIds) {
    const entry = byId.get(id);
    if (entry === undefined || entry.kind === "folder") continue;
    results.push(toResult(entry, "recent", index));
    if (results.length >= (input.limit ?? 8)) break;
  }

  return results;
};
