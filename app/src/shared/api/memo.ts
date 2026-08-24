/**
 * [INPUT]: 依赖 shared/api/client 的统一 Bearer 请求能力与后端 memo_nodes/memos snake_case 响应契约
 * [OUTPUT]: 对外提供轻量 MemoTreeNode、完整 MemoDetailNode、关键词命中/Trash 类型及显式 token 的 memo 资源 API
 * [POS]: app/src/shared/api 的备忘录 HTTP 边界，只做 snake_case DTO 归一化；目录、正文与搜索载荷保持分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { apiRequest } from "./client";
import {
  mapMemoTrashItemDto,
  mapMemoDetailNodeDto,
  mapMemoTreeNodeDto,
  type MemoTreeNodeDto,
  type MemoDetailNodeDto,
} from "./memo.mapper";

/**
 * canvas 与 folder/memo 并列住在同一棵树上（api 的 node_type 约束已扩容），
 * 因此类型必须先认得它——渲染与图标区分由 KnowledgeCanvas 阶段负责。
 */
export type MemoNodeType = "canvas" | "folder" | "memo";

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

export type MemoContentSummary = Omit<MemoContent, "content_mdx">;

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
  memo: MemoContentSummary | null;
};

export type MemoDetailNode = Omit<MemoTreeNode, "children" | "memo"> & {
  children: [];
  memo: MemoContent;
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

export type MemoSearchHit = {
  excerpt: string | null;
  node_id: string;
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
): Promise<MemoDetailNode> => {
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

  return mapMemoDetailNodeDto(
    await apiRequest<MemoDetailNodeDto>(
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
): Promise<MemoDetailNode> =>
  mapMemoDetailNodeDto(
    await apiRequest<MemoDetailNodeDto>(
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
): Promise<MemoDetailNode> =>
  mapMemoDetailNodeDto(
    await apiRequest<MemoDetailNodeDto>(
      `/memos/${encodeURIComponent(nodeId)}`,
      {
        body: JSON.stringify(input),
        keepalive: options.keepalive,
        method: "PATCH",
      },
      accessToken,
    ),
  );

export const searchMemos = async (
  accessToken: string,
  query: string,
  signal?: AbortSignal,
  limit = 20,
): Promise<MemoSearchHit[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
    q: query,
  });
  return apiRequest<MemoSearchHit[]>(
    `/memo-search?${params.toString()}`,
    { signal },
    accessToken,
  );
};

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
