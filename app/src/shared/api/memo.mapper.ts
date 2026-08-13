/**
 * [INPUT]: 依赖 memo API 的领域类型与后端 snake_case DTO 结构
 * [OUTPUT]: 对外提供 active tree 与 Trash DTO 的纯映射函数
 * [POS]: app/src/shared/api 的无副作用契约适配层，让 HTTP 调用与 DTO 测试彼此隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  MemoContent,
  MemoNode,
  MemoTrashItem,
  MemoTreeNode,
} from "./memo";

export type MemoNodeDto = Omit<MemoNode, "sort_order"> & {
  sort_order: number | string;
};

export type MemoTreeNodeDto = MemoNodeDto & {
  children?: MemoTreeNodeDto[];
  memo?: MemoContent | null;
};

export const mapMemoNodeDto = (node: MemoNodeDto): MemoNode => ({
  color: node.color,
  created_at: node.created_at,
  deleted_at: node.deleted_at,
  deleted_root_id: node.deleted_root_id,
  icon: node.icon,
  id: node.id,
  metadata: node.metadata,
  node_type: node.node_type,
  parent_id: node.parent_id,
  revision: node.revision,
  sort_order: String(node.sort_order),
  title: node.title,
  updated_at: node.updated_at,
  user_id: node.user_id,
});

export const mapMemoTreeNodeDto = (node: MemoTreeNodeDto): MemoTreeNode => ({
  ...mapMemoNodeDto(node),
  children: (node.children ?? []).map(mapMemoTreeNodeDto),
  memo: node.memo ?? null,
});

export const mapMemoTrashItemDto = (item: MemoTrashItem): MemoTrashItem => ({
  deleted_at: item.deleted_at,
  excerpt: item.excerpt,
  id: item.id,
  node_type: item.node_type,
  original_path: item.original_path,
  parent_id: item.parent_id,
  title: item.title,
});
