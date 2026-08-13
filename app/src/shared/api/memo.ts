/**
 * [INPUT]: 依赖 shared/api/client 的统一 Bearer 请求能力与后端 memo_nodes/memos snake_case 响应契约
 * [OUTPUT]: 对外提供 MemoTreeNode/MemoTrashItem 类型，以及显式 token 的 active tree CRUD、软删、恢复、永久删与清空 API
 * [POS]: app/src/shared/api 的备忘录 HTTP 边界，只做 snake_case DTO 归一化；active tree 乐观事务与回滚仍由 Store 接管
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { apiRequest } from "./client";
import {
  mapMemoTrashItemDto,
  mapMemoTreeNodeDto,
  type MemoTreeNodeDto,
} from "./memo.mapper";

export type MemoNodeType = "folder" | "memo";

export type MemoContent = {
  node_id: string;
  user_id: string;
  content_mdx: string;
  excerpt: string | null;
  word_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MemoTreeNode = {
  id: string;
  user_id: string;
  parent_id: string | null;
  node_type: MemoNodeType;
  title: string;
  sort_order: string;
  icon: string | null;
  color: string | null;
  metadata: Record<string, unknown>;
  revision: number;
  deleted_at: string | null;
  deleted_root_id: string | null;
  created_at: string;
  updated_at: string;
  children: MemoTreeNode[];
  memo: MemoContent | null;
};

export type MemoNode = Omit<MemoTreeNode, "children" | "memo">;

export type MemoTrashItem = {
  id: string;
  node_type: MemoNodeType;
  title: string;
  parent_id: string | null;
  original_path: string;
  deleted_at: string;
  excerpt: string | null;
};

export type MemoTrashMutation = {
  id: string;
  deleted_at: string;
};

export type MemoTrashClearResult = {
  deleted_count: number;
};

export type CreateMemoFolderInput = {
  parent_id: string | null;
  title: string;
};

export type CreateMemoInput = {
  parent_id: string | null;
  title: string;
  content_mdx?: string;
  sort_order?: string;
};

export type UpdateMemoInput = {
  content_mdx?: string;
  title?: string;
};

export type UpdateMemoNodeInput = {
  title: string;
};

export type MoveMemoNodeInput = {
  parent_id: string | null;
  sort_order: string;
};

export type MemoWriteOptions = {
  keepalive?: boolean;
};

const serializeSortOrder = (sortOrder: string): number => {
  const value = Number(sortOrder);

  if (!Number.isFinite(value)) {
    throw new TypeError("sort_order 必须是有限数字字符串。");
  }

  return value;
};

export const getMemoTree = async (
  accessToken: string,
  signal?: AbortSignal,
): Promise<MemoTreeNode[]> =>
  (await apiRequest<MemoTreeNodeDto[]>(
    "/memo-tree",
    { signal },
    accessToken,
  )).map(mapMemoTreeNodeDto);

export const createMemoFolder = async (
  accessToken: string,
  input: CreateMemoFolderInput,
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      "/memo-folders",
      {
        body: JSON.stringify(input),
        method: "POST",
      },
      accessToken,
    ),
  );

export const createMemo = async (
  accessToken: string,
  input: CreateMemoInput,
): Promise<MemoTreeNode> => {
  const body: Record<string, number | string | null> = {
    parent_id: input.parent_id,
    title: input.title,
  };

  if (input.content_mdx !== undefined) {
    body["content_mdx"] = input.content_mdx;
  }

  if (input.sort_order !== undefined) {
    body["sort_order"] = serializeSortOrder(input.sort_order);
  }

  return mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      "/memos",
      {
        body: JSON.stringify(body),
        method: "POST",
      },
      accessToken,
    ),
  );
};

export const getMemo = async (
  accessToken: string,
  nodeId: string,
  signal?: AbortSignal,
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      `/memos/${encodeURIComponent(nodeId)}`,
      { signal },
      accessToken,
    ),
  );

export const updateMemo = async (
  accessToken: string,
  nodeId: string,
  input: UpdateMemoInput,
  options: MemoWriteOptions = {},
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      `/memos/${encodeURIComponent(nodeId)}`,
      {
        body: JSON.stringify(input),
        keepalive: options.keepalive,
        method: "PATCH",
      },
      accessToken,
    ),
  );

export const updateMemoNode = async (
  accessToken: string,
  nodeId: string,
  input: UpdateMemoNodeInput,
  options: MemoWriteOptions = {},
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      `/memo-nodes/${encodeURIComponent(nodeId)}`,
      {
        body: JSON.stringify(input),
        keepalive: options.keepalive,
        method: "PATCH",
      },
      accessToken,
    ),
  );

export const moveMemoNode = async (
  accessToken: string,
  nodeId: string,
  input: MoveMemoNodeInput,
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      `/memo-nodes/${encodeURIComponent(nodeId)}/move`,
      {
        body: JSON.stringify({
          parent_id: input.parent_id,
          sort_order: serializeSortOrder(input.sort_order),
        }),
        method: "PATCH",
      },
      accessToken,
    ),
  );

export const getMemoTrash = async (
  accessToken: string,
  signal?: AbortSignal,
): Promise<MemoTrashItem[]> =>
  (await apiRequest<MemoTrashItem[]>(
    "/memo-trash",
    { signal },
    accessToken,
  )).map(mapMemoTrashItemDto);

export const softDeleteMemoNode = async (
  accessToken: string,
  nodeId: string,
): Promise<MemoTrashMutation> =>
  apiRequest<MemoTrashMutation>(
    `/memo-nodes/${encodeURIComponent(nodeId)}/trash`,
    { method: "POST" },
    accessToken,
  );

export const restoreMemoNode = async (
  accessToken: string,
  nodeId: string,
): Promise<MemoTreeNode> =>
  mapMemoTreeNodeDto(
    await apiRequest<MemoTreeNodeDto>(
      `/memo-nodes/${encodeURIComponent(nodeId)}/restore`,
      { method: "POST" },
      accessToken,
    ),
  );

export const permanentlyDeleteMemoNode = async (
  accessToken: string,
  nodeId: string,
): Promise<MemoTrashClearResult> =>
  apiRequest<MemoTrashClearResult>(
    `/memo-nodes/${encodeURIComponent(nodeId)}`,
    { method: "DELETE" },
    accessToken,
  );

export const emptyMemoTrash = async (
  accessToken: string,
): Promise<MemoTrashClearResult> =>
  apiRequest<MemoTrashClearResult>(
    "/memo-trash",
    { method: "DELETE" },
    accessToken,
  );
