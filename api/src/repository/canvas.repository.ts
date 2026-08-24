/**
 * [INPUT]: 依赖唯一 supabase-rest 适配器、canvas DTO 的四个 RPC 结果 schema、canvas_nodes 行查询与请求期用户 access token
 * [OUTPUT]: 对外提供 saveExploration/read/updateLayout/promote 四个受控 RPC 调用、findCanvasNodeId/createCard 单卡写入、findCardText 单卡正文读取与脱敏存储错误
 * [POS]: repository 层知识画布数据访问器；写操作一律走 SECURITY INVOKER RPC，因为保存与晋升都要求多张表一起成立，PostgREST 的逐表写入表达不了原子性
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  canvasCardRowSchema,
  canvasLayoutRpcResultSchema,
  promoteCanvasNodeRpcResultSchema,
  readCanvasRpcResultSchema,
  saveCanvasRpcResultSchema,
  type CanvasCardRow,
  type CanvasLayoutRpcResult,
  type PromoteCanvasNodeRpcResult,
  type ReadCanvasRpcResult,
  type SaveCanvasRpcResult,
} from "../dto/canvas.dto.ts";
import { createPostgrestQuery, supabaseRest } from "../lib/supabase-rest.ts";
import { z } from "zod";

const canvasStorageError = (): HttpError =>
  new HttpError(502, "CANVAS_STORAGE_ERROR", "Canvas storage operation failed");

const cardTextRowsSchema = z.array(z.object({
  id: z.uuid(),
  kind: z.enum(["memo_ref", "excerpt", "native"]),
  text: z.string().nullable(),
}));

const callRpc = async <T>(
  name: string,
  body: Record<string, unknown>,
  accessToken: string,
  parse: (payload: unknown) => { success: boolean; data?: T },
): Promise<T> => {
  let payload: unknown;

  try {
    payload = await supabaseRest<unknown>(`rpc/${name}`, {
      accessToken,
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    throw canvasStorageError();
  }

  const parsed = parse(payload);

  if (!parsed.success || parsed.data === undefined) {
    throw canvasStorageError();
  }

  return parsed.data;
};

export const canvasRepository = {
  async saveExploration(
    input: {
      items: unknown[];
      originNodeId: string;
      parentId: string | null;
      sortOrder: number;
      title: string;
      userId: string;
      viewport: Record<string, unknown>;
    },
    accessToken: string,
  ): Promise<SaveCanvasRpcResult> {
    return callRpc(
      "save_exploration_canvas",
      {
        p_user_id: input.userId,
        p_title: input.title,
        p_parent_id: input.parentId,
        p_sort_order: input.sortOrder,
        p_origin_node_id: input.originNodeId,
        p_viewport: input.viewport,
        p_items: input.items,
      },
      accessToken,
      (payload) => saveCanvasRpcResultSchema.safeParse(payload),
    );
  },

  async read(
    userId: string,
    canvasId: string,
    accessToken: string,
  ): Promise<ReadCanvasRpcResult> {
    return callRpc(
      "read_canvas",
      { p_user_id: userId, p_canvas_id: canvasId },
      accessToken,
      (payload) => readCanvasRpcResultSchema.safeParse(payload),
    );
  },

  async updateLayout(
    input: {
      canvasId: string;
      cards: unknown[];
      userId: string;
      viewport: Record<string, unknown> | null;
    },
    accessToken: string,
  ): Promise<CanvasLayoutRpcResult> {
    return callRpc(
      "update_canvas_layout",
      {
        p_user_id: input.userId,
        p_canvas_id: input.canvasId,
        p_viewport: input.viewport,
        p_cards: input.cards,
      },
      accessToken,
      (payload) => canvasLayoutRpcResultSchema.safeParse(payload),
    );
  },

  /** 晋升前读取待搬运的正文；摘要与字数的派生规则住在 service，不在数据库里复制一份 */
  async findCardText(
    userId: string,
    cardId: string,
    accessToken: string,
  ): Promise<{ kind: string; text: string | null } | null> {
    const query = createPostgrestQuery({
      select: "id,kind,text",
      eq: { user_id: userId, id: cardId },
      limit: 1,
    });

    let payload: unknown;

    try {
      payload = await supabaseRest<unknown>(`canvas_nodes${query}`, {
        accessToken,
      });
    } catch {
      throw canvasStorageError();
    }

    const parsed = cardTextRowsSchema.safeParse(payload);

    if (!parsed.success) {
      throw canvasStorageError();
    }

    const row = parsed.data[0];

    return row === undefined ? null : { kind: row.kind, text: row.text };
  },

  /** 画布是否存在且属于本人；卡片插入前的轻量前置检查，避免约束错误被当成存储故障 */
  async findCanvasNodeId(
    userId: string,
    canvasId: string,
    accessToken: string,
  ): Promise<string | null> {
    const query = createPostgrestQuery({
      select: "node_id",
      eq: { user_id: userId, node_id: canvasId },
      limit: 1,
    });

    let payload: unknown;

    try {
      payload = await supabaseRest<unknown>(`canvases${query}`, { accessToken });
    } catch {
      throw canvasStorageError();
    }

    const parsed = z.array(z.object({ node_id: z.uuid() })).safeParse(payload);

    if (!parsed.success) {
      throw canvasStorageError();
    }

    return parsed.data[0]?.node_id ?? null;
  },

  /** 单行插入无需原子性，故走 PostgREST；形状约束与同租户校验由表和触发器保证 */
  async createCard(
    data: Record<string, unknown>,
    accessToken: string,
  ): Promise<CanvasCardRow> {
    let payload: unknown;

    try {
      payload = await supabaseRest<unknown>("canvas_nodes", {
        accessToken,
        method: "POST",
        body: JSON.stringify(data),
        returnRepresentation: true,
      });
    } catch {
      throw canvasStorageError();
    }

    const parsed = z.array(canvasCardRowSchema).safeParse(payload);

    if (!parsed.success || parsed.data[0] === undefined) {
      throw canvasStorageError();
    }

    return parsed.data[0];
  },

  async promote(
    input: {
      cardId: string;
      excerpt: string | null;
      parentId: string | null;
      sortOrder: number;
      title: string | null;
      userId: string;
      wordCount: number;
    },
    accessToken: string,
  ): Promise<PromoteCanvasNodeRpcResult> {
    return callRpc(
      "promote_canvas_node",
      {
        p_user_id: input.userId,
        p_canvas_node_id: input.cardId,
        p_parent_id: input.parentId,
        p_sort_order: input.sortOrder,
        p_title: input.title,
        p_excerpt: input.excerpt,
        p_word_count: input.wordCount,
      },
      accessToken,
      (payload) => promoteCanvasNodeRpcResultSchema.safeParse(payload),
    );
  },
};
