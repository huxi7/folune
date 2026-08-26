/**
 * [INPUT]: 依赖唯一 supabase-rest 适配器、Canvas V2 entry/read/mutation/context RPC schemas 与请求期 access token
 * [OUTPUT]: 对外提供默认/独立 Canvas 创建、V2 读取、统一人工/AI mutation 与可信 expansion context RPC 调用
 * [POS]: repository 层 Canvas V2 唯一数据访问器；所有图写入只调用 apply_canvas_mutation，不逐表写、不触达 memo_relations
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  canvasEntryRpcResultSchema,
  canvasExpansionContextRpcResultSchema,
  canvasMutationRpcResultSchema,
  readCanvasV2RpcResultSchema,
  type CanvasEntryRpcResult,
  type CanvasExpansionContextRpcResult,
  type CanvasExpansionMutationInput,
  type CanvasMutationInput,
  type CanvasMutationRpcResult,
  type ReadCanvasV2RpcResult,
} from "../dto/canvas.dto.ts";
import { supabaseRest } from "../lib/supabase-rest.ts";

const canvasStorageError = (): HttpError =>
  new HttpError(502, "CANVAS_STORAGE_ERROR", "Canvas storage operation failed");

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
      body: JSON.stringify(body),
      method: "POST",
    });
  } catch {
    throw canvasStorageError();
  }
  const parsed = parse(payload);
  if (!parsed.success || parsed.data === undefined) throw canvasStorageError();
  return parsed.data;
};

export const canvasRepository = {
  getOrCreateForMemo(
    userId: string,
    memoId: string,
    accessToken: string,
  ): Promise<CanvasEntryRpcResult> {
    return callRpc(
      "get_or_create_memo_canvas",
      { p_memo_id: memoId, p_user_id: userId },
      accessToken,
      (payload) => canvasEntryRpcResultSchema.safeParse(payload),
    );
  },

  createStandalone(
    input: { userId: string; title: string; parentId: string | null },
    accessToken: string,
  ): Promise<CanvasEntryRpcResult> {
    return callRpc(
      "create_standalone_canvas",
      {
        p_parent_id: input.parentId,
        p_title: input.title,
        p_user_id: input.userId,
      },
      accessToken,
      (payload) => canvasEntryRpcResultSchema.safeParse(payload),
    );
  },

  readV2(
    userId: string,
    canvasId: string,
    accessToken: string,
  ): Promise<ReadCanvasV2RpcResult> {
    return callRpc(
      "read_canvas_v2",
      { p_canvas_id: canvasId, p_user_id: userId },
      accessToken,
      (payload) => readCanvasV2RpcResultSchema.safeParse(payload),
    );
  },

  mutate(
    userId: string,
    canvasId: string,
    input: CanvasMutationInput,
    expansion: CanvasExpansionMutationInput | null,
    accessToken: string,
  ): Promise<CanvasMutationRpcResult> {
    return callRpc(
      "apply_canvas_mutation",
      {
        p_base_version: input.base_version,
        p_canvas_id: canvasId,
        p_expansion: expansion === null ? null : {
          candidate_revisions: expansion.candidate_revisions,
          completion_status: expansion.completion_status,
          corpus_version: expansion.corpus_version,
          request_id: expansion.request_id,
          source_canvas_node_id: expansion.source_canvas_node_id,
          source_revision: expansion.source_revision,
        },
        p_mutation_id: input.mutation_id,
        p_operations: input.operations,
        p_protocol_version: input.protocol_version,
        p_user_id: userId,
      },
      accessToken,
      (payload) => canvasMutationRpcResultSchema.safeParse(payload),
    );
  },

  readExpansionContext(
    userId: string,
    canvasId: string,
    sourceCanvasNodeId: string,
    accessToken: string,
  ): Promise<CanvasExpansionContextRpcResult> {
    return callRpc(
      "read_canvas_expansion_context",
      {
        p_canvas_id: canvasId,
        p_source_canvas_node_id: sourceCanvasNodeId,
        p_user_id: userId,
      },
      accessToken,
      (payload) => canvasExpansionContextRpcResultSchema.safeParse(payload),
    );
  },
};
