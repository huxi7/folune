/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 领域类型
 * [OUTPUT]: 对外提供 MemoNode、MemoContent、MemoTreeNode、MemoTrashItem 及创建/更新数据类型
 * [POS]: model 层备忘录领域契约，将 active tree、删除批次和回收站最小展示数据与正文存储边界分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type MemoNodeType = "folder" | "memo";

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

export interface MemoTreeNode extends MemoNode {
  children: MemoTreeNode[];
  memo: MemoContent | null;
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
