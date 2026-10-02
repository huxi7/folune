/**
 * [INPUT]: 依赖唯一 supabase-rest 适配器、memo DTO 行校验、memo 领域创建/更新类型与请求期用户 access token
 * [OUTPUT]: 对外提供强制 user_id 的轻量 tree/回收站查询、同级同类型节点命名快照、memo_nodes/memos CRUD、关键词与混合召回两个检索 RPC、删除生命周期 RPC 与脱敏存储错误；恢复撞上同级重名时回 MEMO_TITLE_CONFLICT 而不是折叠成 502
 * [POS]: repository 层备忘录 PostgREST 数据访问器，只表达表/RPC 操作与返回校验，不判断树、恢复可见性或业务状态；中文检索一律走 PGroonga RPC，因为 `&@*` 相似检索只在索引扫描下生效，PostgREST 的行过滤无法表达
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  isMemoTitleConflict,
  memoTitleConflictError,
} from "../common/memo-title.ts";
import {
  emptyMemoTrashRpcResultSchema,
  memoContentRowsSchema,
  memoContentSummaryRowsSchema,
  memoNodeRowsSchema,
  memoSearchKeywordRpcResultSchema,
  memoSearchRelatedRpcResultSchema,
  memoSortOrderRowsSchema,
  memoTrashExcerptRowsSchema,
  permanentlyDeleteMemoRpcResultSchema,
  restoreMemoRpcResultSchema,
  softDeleteMemoRpcResultSchema,
  type EmptyMemoTrashRpcResult,
  type MemoSearchKeywordRpcResult,
  type MemoSearchRelatedRpcResult,
  type PermanentlyDeleteMemoRpcResult,
  type RestoreMemoRpcResult,
  type SoftDeleteMemoRpcResult,
} from "../dto/memo.dto.ts";
import {
  createPostgrestQuery,
  supabaseRest,
} from "../lib/supabase-rest.ts";
import type {
  CreateMemoContentData,
  CreateMemoNodeData,
  MemoContent,
  MemoContentSummary,
  MemoNode,
  UpdateMemoContentData,
  UpdateMemoNodeData,
} from "../model/memo.model.ts";

const parseNodeRows = (payload: unknown): MemoNode[] => {
  const parsed = memoNodeRowsSchema.safeParse(payload ?? []);

  if (!parsed.success) {
    throw new HttpError(
      502,
      "SUPABASE_REST_ERROR",
      "Supabase REST returned invalid memo node data",
    );
  }

  return parsed.data;
};

const parseContentRows = (payload: unknown): MemoContent[] => {
  const parsed = memoContentRowsSchema.safeParse(payload ?? []);

  if (!parsed.success) {
    throw new HttpError(
      502,
      "SUPABASE_REST_ERROR",
      "Supabase REST returned invalid memo content data",
    );
  }

  return parsed.data;
};

const parseContentSummaryRows = (payload: unknown): MemoContentSummary[] => {
  const parsed = memoContentSummaryRowsSchema.safeParse(payload ?? []);

  if (!parsed.success) {
    throw new HttpError(
      502,
      "SUPABASE_REST_ERROR",
      "Supabase REST returned invalid memo content summary data",
    );
  }

  return parsed.data;
};

const searchStorageError = (): HttpError =>
  new HttpError(
    502,
    "MEMO_SEARCH_STORAGE_ERROR",
    "Memo search storage operation failed",
  );

const trashStorageError = (): HttpError =>
  new HttpError(
    502,
    "MEMO_TRASH_STORAGE_ERROR",
    "Memo trash storage operation failed",
  );

const runTrashOperation = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    /*
     * 恢复会把一个软删对象重新变成活跃兄弟, 因此它可能撞上同父同类型重名。
     * 那不是"存储故障", 是用户需要改名才能继续的具体原因; 把它折叠成
     * 502 会让人以为后端坏了。
     */
    if (isMemoTitleConflict(error)) throw memoTitleConflictError();
    throw trashStorageError();
  }
};

const activeNodeQuery = (
  userId: string,
  nodeId?: string,
): string =>
  createPostgrestQuery({
    select: "*",
    eq: {
      user_id: userId,
      ...(nodeId === undefined ? {} : { id: nodeId }),
    },
    is: { deleted_at: null },
    order:
      nodeId === undefined
        ? [
            { column: "sort_order", ascending: true },
            { column: "id", ascending: true },
          ]
        : undefined,
    limit: nodeId === undefined ? undefined : 1,
  });

export const memoRepository = {
  async listActiveNodes(
    userId: string,
    accessToken: string,
  ): Promise<MemoNode[]> {
    const payload = await supabaseRest<unknown>(
      `memo_nodes${activeNodeQuery(userId)}`,
      { accessToken },
    );

    return parseNodeRows(payload);
  },

  async listActiveSiblingNodes(
    userId: string,
    parentId: string | null,
    nodeType: "memo" | "canvas",
    accessToken: string,
  ): Promise<MemoNode[]> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, node_type: nodeType, ...(parentId === null ? {} : { parent_id: parentId }) },
      is: { deleted_at: null, ...(parentId === null ? { parent_id: null } : {}) },
    });
    return parseNodeRows(await supabaseRest<unknown>(`memo_nodes${query}`, { accessToken }));
  },

  async listContentSummaries(
    userId: string,
    accessToken: string,
  ): Promise<MemoContentSummary[]> {
    const query = createPostgrestQuery({
      select: [
        "node_id",
        "user_id",
        "excerpt",
        "word_count",
        "metadata",
        "created_at",
        "updated_at",
      ],
      eq: { user_id: userId },
    });
    const payload = await supabaseRest<unknown>(`memos${query}`, {
      accessToken,
    });

    return parseContentSummaryRows(payload);
  },

  async listContents(
    userId: string,
    accessToken: string,
    nodeIds: readonly string[],
  ): Promise<MemoContent[]> {
    if (nodeIds.length === 0) return [];
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId },
      in: { node_id: nodeIds },
    });
    const payload = await supabaseRest<unknown>(`memos${query}`, {
      accessToken,
    });
    return parseContentRows(payload);
  },

  async searchKeyword(
    userId: string,
    searchQuery: string,
    limit: number,
    accessToken: string,
  ): Promise<MemoSearchKeywordRpcResult> {
    const payload = await supabaseRest<unknown>("rpc/search_memos_keyword", {
      accessToken,
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_query_text: searchQuery,
        p_limit: limit,
      }),
    });
    const parsed = memoSearchKeywordRpcResultSchema.safeParse(payload);

    if (!parsed.success) {
      throw searchStorageError();
    }

    return parsed.data;
  },

  async searchRelated(
    userId: string,
    queryText: string,
    sourceNodeId: string | null,
    limit: number,
    excludeNodeIds: string[],
    accessToken: string,
  ): Promise<MemoSearchRelatedRpcResult> {
    const payload = await supabaseRest<unknown>("rpc/search_memos_hybrid", {
      accessToken,
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_query_text: queryText,
        p_source_node_id: sourceNodeId,
        p_limit: limit,
        p_exclude_node_ids: excludeNodeIds,
      }),
    });
    const parsed = memoSearchRelatedRpcResultSchema.safeParse(payload);

    if (!parsed.success) {
      throw searchStorageError();
    }

    return parsed.data;
  },

  async findActiveNodeById(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<MemoNode | null> {
    const payload = await supabaseRest<unknown>(
      `memo_nodes${activeNodeQuery(userId, nodeId)}`,
      { accessToken },
    );

    return parseNodeRows(payload)[0] ?? null;
  },

  async findNodeById(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<MemoNode | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: nodeId },
      limit: 1,
    });
    const payload = await supabaseRest<unknown>(`memo_nodes${query}`, {
      accessToken,
    });

    return parseNodeRows(payload)[0] ?? null;
  },

  async listTrashNodes(
    userId: string,
    accessToken: string,
  ): Promise<MemoNode[]> {
    return runTrashOperation(async () => {
      const query = createPostgrestQuery({
        select: "*",
        eq: { user_id: userId },
        order: [
          { column: "deleted_at", ascending: false, nullsFirst: false },
          { column: "id", ascending: true },
        ],
      });
      const payload = await supabaseRest<unknown>(`memo_nodes${query}`, {
        accessToken,
      });

      return parseNodeRows(payload);
    });
  },

  async listTrashExcerpts(
    userId: string,
    accessToken: string,
  ): Promise<Array<{ node_id: string; user_id: string; excerpt: string | null }>> {
    return runTrashOperation(async () => {
      const query = createPostgrestQuery({
        select: ["node_id", "user_id", "excerpt"],
        eq: { user_id: userId },
      });
      const payload = await supabaseRest<unknown>(`memos${query}`, {
        accessToken,
      });
      const parsed = memoTrashExcerptRowsSchema.safeParse(payload ?? []);

      if (!parsed.success) {
        throw trashStorageError();
      }

      return parsed.data;
    });
  },

  async findContentByNodeId(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<MemoContent | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, node_id: nodeId },
      limit: 1,
    });
    const payload = await supabaseRest<unknown>(`memos${query}`, {
      accessToken,
    });

    return parseContentRows(payload)[0] ?? null;
  },

  async findMaxSortOrder(
    userId: string,
    parentId: string | null,
    accessToken: string,
  ): Promise<number | null> {
    const query = createPostgrestQuery({
      select: "sort_order",
      eq: {
        user_id: userId,
        ...(parentId === null ? {} : { parent_id: parentId }),
      },
      is: {
        deleted_at: null,
        ...(parentId === null ? { parent_id: null } : {}),
      },
      order: [
        { column: "sort_order", ascending: false },
        { column: "id", ascending: false },
      ],
      limit: 1,
    });
    const payload = await supabaseRest<unknown>(
      `memo_nodes${query}`,
      { accessToken },
    );
    const parsed = memoSortOrderRowsSchema.safeParse(payload ?? []);

    if (!parsed.success) {
      throw new HttpError(
        502,
        "SUPABASE_REST_ERROR",
        "Supabase REST returned invalid memo sort data",
      );
    }

    return parsed.data[0]?.sort_order ?? null;
  },

  async createNode(
    data: CreateMemoNodeData,
    accessToken: string,
  ): Promise<MemoNode | null> {
    const payload = await supabaseRest<unknown>("memo_nodes", {
      accessToken,
      method: "POST",
      body: JSON.stringify(data),
      returnRepresentation: true,
    });

    return parseNodeRows(payload)[0] ?? null;
  },

  async createContent(
    data: CreateMemoContentData,
    accessToken: string,
  ): Promise<MemoContent | null> {
    const payload = await supabaseRest<unknown>("memos", {
      accessToken,
      method: "POST",
      body: JSON.stringify(data),
      returnRepresentation: true,
    });

    return parseContentRows(payload)[0] ?? null;
  },

  async updateNode(
    userId: string,
    nodeId: string,
    input: UpdateMemoNodeData,
    accessToken: string,
  ): Promise<MemoNode | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: nodeId },
      is: { deleted_at: null },
    });
    const payload = await supabaseRest<unknown>(
      `memo_nodes${query}`,
      {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
        returnRepresentation: true,
      },
    );

    return parseNodeRows(payload)[0] ?? null;
  },

  async updateContent(
    userId: string,
    nodeId: string,
    input: UpdateMemoContentData,
    accessToken: string,
  ): Promise<MemoContent | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, node_id: nodeId },
    });
    const payload = await supabaseRest<unknown>(`memos${query}`, {
      accessToken,
      method: "PATCH",
      body: JSON.stringify(input),
      returnRepresentation: true,
    });

    return parseContentRows(payload)[0] ?? null;
  },

  async deleteNode(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<MemoNode | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { user_id: userId, id: nodeId },
    });
    const payload = await supabaseRest<unknown>(
      `memo_nodes${query}`,
      {
        accessToken,
        method: "DELETE",
        returnRepresentation: true,
      },
    );

    return parseNodeRows(payload)[0] ?? null;
  },

  async softDeleteNode(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<SoftDeleteMemoRpcResult> {
    return runTrashOperation(async () => {
      const payload = await supabaseRest<unknown>(
        "rpc/soft_delete_memo_node",
        {
          accessToken,
          method: "POST",
          body: JSON.stringify({ p_user_id: userId, p_node_id: nodeId }),
        },
      );
      const parsed = softDeleteMemoRpcResultSchema.safeParse(payload);

      if (!parsed.success) {
        throw trashStorageError();
      }

      return parsed.data;
    });
  },

  async restoreNode(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<RestoreMemoRpcResult> {
    return runTrashOperation(async () => {
      const payload = await supabaseRest<unknown>("rpc/restore_memo_node", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ p_user_id: userId, p_node_id: nodeId }),
      });
      const parsed = restoreMemoRpcResultSchema.safeParse(payload);

      if (!parsed.success) {
        throw trashStorageError();
      }

      return parsed.data;
    });
  },

  async permanentlyDeleteNode(
    userId: string,
    nodeId: string,
    accessToken: string,
  ): Promise<PermanentlyDeleteMemoRpcResult> {
    return runTrashOperation(async () => {
      const payload = await supabaseRest<unknown>(
        "rpc/permanently_delete_memo_node",
        {
          accessToken,
          method: "POST",
          body: JSON.stringify({ p_user_id: userId, p_node_id: nodeId }),
        },
      );
      const parsed = permanentlyDeleteMemoRpcResultSchema.safeParse(payload);

      if (!parsed.success) {
        throw trashStorageError();
      }

      return parsed.data;
    });
  },

  async emptyTrash(
    userId: string,
    accessToken: string,
  ): Promise<EmptyMemoTrashRpcResult> {
    return runTrashOperation(async () => {
      const payload = await supabaseRest<unknown>("rpc/empty_memo_trash", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ p_user_id: userId }),
      });
      const parsed = emptyMemoTrashRpcResultSchema.safeParse(payload);

      if (!parsed.success) {
        throw trashStorageError();
      }

      return parsed.data;
    });
  },
};
