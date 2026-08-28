/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型
 * [OUTPUT]: 对外提供 MemoNode、MemoContent、MemoContentSummary、轻量 MemoTreeNode（canvas 节点附带 MemoCanvasIdentity）、完整 MemoDetailNode、关键词命中 MemoSearchHit、相似候选 MemoRelatedHit 与创建/更新数据类型
 * [POS]: model 层备忘录领域契约，将 active tree、单篇正文、关键词命中、相似候选和回收站展示数据彻底分离；MemoRelatedHit 携带命中通道与融合名次，供上层排序与解释召回来源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** canvas 与 memo/folder 并列住在同一棵树上，因此整树读取必须认得它 */
export type MemoNodeType = "folder" | "memo" | "canvas";

export interface MemoNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  node_type: MemoNodeType;
  title: string;
  sort_order: number;
  icon: string | null;
  color: string | null;
  metadata: Readonly<Record<string, unknown>>;
  revision: number;
  deleted_at: string | null;
  deleted_root_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoContent {
  node_id: string;
  user_id: string;
  content_mdx: string;
  excerpt: string | null;
  word_count: number;
  metadata: Readonly<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export type MemoContentSummary = Omit<MemoContent, "content_mdx">;

/**
 * canvas 树节点的身份。默认画布带来源笔记 id，独立画布没有；只有 node_type
 * 为 canvas 的节点才携带这个字段，folder/memo 节点连键都不出现。客户端靠它把
 * "某篇笔记的默认画布"从搜索结果里去重成那篇笔记行上的次级动作。
 */
export interface MemoCanvasIdentity {
  kind: "memo_default" | "standalone";
  origin_node_id: string | null;
}

export interface MemoTreeNode extends MemoNode {
  canvas?: MemoCanvasIdentity;
  children: MemoTreeNode[];
  memo: MemoContentSummary | null;
}

export interface MemoDetailNode extends MemoNode {
  children: [];
  memo: MemoContent;
}

export interface MemoSearchHit {
  node_id: string;
  excerpt: string | null;
}

export interface MemoRelatedHit {
  node_id: string;
  title: string;
  excerpt: string | null;
  revision: number;
  matched_channels: string[];
  rank: number;
}

export interface MemoTrashItem {
  id: string;
  node_type: MemoNodeType;
  title: string;
  parent_id: string | null;
  original_path: string;
  deleted_at: string;
  excerpt: string | null;
}

export interface MemoTrashMutation {
  id: string;
  deleted_at: string;
}

export interface MemoTrashClearResult {
  deleted_count: number;
}

export interface CreateMemoNodeData {
  user_id: string;
  parent_id: string | null;
  node_type: MemoNodeType;
  title: string;
  sort_order: number;
}

export interface CreateMemoContentData {
  node_id: string;
  user_id: string;
  content_mdx: string;
  excerpt: string | null;
  word_count: number;
}

export interface UpdateMemoNodeData {
  parent_id?: string | null;
  title?: string;
  sort_order?: number;
}

export interface UpdateMemoContentData {
  content_mdx: string;
  excerpt: string | null;
  word_count: number;
}
