/**
 * [INPUT]: 依赖可信 AuthUser/JWT、Canvas V2 entry/read/mutation/context DTO、唯一 canvas repository 与结构化 HttpError
 * [OUTPUT]: 对外提供默认/独立 Canvas 创建（独立 Canvas 的系统默认名撞名时顺位让开）、读取、人工 mutation、AI expansion commit 与可信 context
 * [POS]: service 层 Canvas V2 状态映射边界；人工与 AI 写入都下沉到同一数据库内核，409 携带版本事实供 WAL 安全 rebase
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import { createWithAvailableTitle } from "../common/memo-title.ts";
import type {
  CanvasEntryRpcResult,
  CanvasExpansionContextRpcResult,
  CanvasExpansionMutationInput,
  CanvasMutationInput,
  CanvasMutationRpcResult,
  CreateCanvasV2Input,
  ReadCanvasV2RpcResult,
} from "../dto/canvas.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  CanvasDetailV2,
  CanvasEntryResult,
  CanvasExpansionContext,
  CanvasMutationResultV2,
} from "../model/canvas.model.ts";
import type { MemoNode } from "../model/memo.model.ts";
import { canvasRepository } from "../repository/canvas.repository.ts";

const canvasNotFound = (): HttpError =>
  new HttpError(404, "CANVAS_NOT_FOUND", "Canvas was not found");

const parentNotFolder = (): HttpError =>
  new HttpError(
    404,
    "MEMO_PARENT_NOT_FOLDER",
    "Parent node was not found or is not a folder",
  );

const invalidCanvas = (result: { error_code?: string }): HttpError =>
  new HttpError(
    400,
    result.error_code ?? "CANVAS_INVALID",
    "Canvas input was invalid",
  );

const requireEntry = (result: CanvasEntryRpcResult): CanvasEntryResult => {
  if (result.status === "created" || result.status === "existing") {
    return {
      canvas: result.canvas,
      created: result.status === "created",
      focus_node_id: result.focus_node_id,
      node: result.node as MemoNode,
    };
  }
  if (result.status === "memo_not_found") {
    throw new HttpError(404, "MEMO_NOT_FOUND", "Memo was not found");
  }
  if (result.status === "parent_not_found") throw parentNotFolder();
  if (result.status === "invalid") throw invalidCanvas(result);
  throw canvasNotFound();
};

const requireDetail = (result: ReadCanvasV2RpcResult): CanvasDetailV2 => {
  if (result.status !== "ok") throw canvasNotFound();
  return {
    canvas: result.canvas,
    edges: result.edges,
    node: result.node as MemoNode,
    nodes: result.nodes,
  };
};

const requireMutation = (
  result: CanvasMutationRpcResult,
): CanvasMutationResultV2 => {
  if (result.status === "applied") return result;
  if (result.status === "version_conflict") {
    throw new HttpError(
      409,
      "CANVAS_VERSION_CONFLICT",
      "Canvas changed in another session",
      { mutation_id: result.mutation_id, version: result.version },
    );
  }
  if (result.status === "mutation_id_reused") {
    throw new HttpError(
      409,
      "MUTATION_ID_REUSED",
      "Mutation ID was reused with a different intent",
      { mutation_id: result.mutation_id, version: result.version },
    );
  }
  if (result.status === "source_revision_conflict") {
    throw new HttpError(
      409,
      "CANVAS_SOURCE_REVISION_CONFLICT",
      "The source memo changed before expansion was committed",
    );
  }
  if (result.status === "candidate_revision_conflict") {
    throw new HttpError(
      409,
      "CANVAS_CANDIDATE_REVISION_CONFLICT",
      "A related memo changed before expansion was committed",
      { memo_id: result.memo_id },
    );
  }
  if (result.status === "invalid") throw invalidCanvas(result);
  throw canvasNotFound();
};

const requireExpansionContext = (
  result: CanvasExpansionContextRpcResult,
): CanvasExpansionContext => {
  if (result.status === "ok") return result;
  if (result.status === "invalid_source") {
    throw new HttpError(
      400,
      "CANVAS_EXPANSION_SOURCE_INVALID",
      "Select an active memo node before expanding",
    );
  }
  throw canvasNotFound();
};

export const canvasService = {
  async getOrCreateForMemo(
    authUser: AuthUser,
    accessToken: string,
    memoId: string,
  ): Promise<CanvasEntryResult> {
    return requireEntry(
      await canvasRepository.getOrCreateForMemo(authUser.id, memoId, accessToken),
    );
  },

  async createStandalone(
    authUser: AuthUser,
    accessToken: string,
    input: CreateCanvasV2Input,
  ): Promise<CanvasEntryResult> {
    /*
     * 新建独立 Canvas 的标题是系统默认名（「未命名 Canvas」），与新建备忘录
     * 同理：同一目录里连着新建两次必然撞上同父同类型唯一约束，因此默认名顺位
     * 让开，而不是让最高频的动作直接失败。
     */
    return await createWithAvailableTitle(input.title, async (title) =>
      requireEntry(await canvasRepository.createStandalone({
        parentId: input.parent_id ?? null,
        title,
        userId: authUser.id,
      }, accessToken)));
  },

  async read(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
  ): Promise<CanvasDetailV2> {
    return requireDetail(
      await canvasRepository.readV2(authUser.id, canvasId, accessToken),
    );
  },

  async mutate(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
    input: CanvasMutationInput,
  ): Promise<CanvasMutationResultV2> {
    return requireMutation(
      await canvasRepository.mutate(authUser.id, canvasId, input, null, accessToken),
    );
  },

  async commitExpansion(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
    input: CanvasExpansionMutationInput,
  ): Promise<CanvasMutationResultV2> {
    return requireMutation(
      await canvasRepository.mutate(authUser.id, canvasId, input, input, accessToken),
    );
  },

  async getExpansionContext(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
    sourceCanvasNodeId: string,
  ): Promise<CanvasExpansionContext> {
    return requireExpansionContext(
      await canvasRepository.readExpansionContext(
        authUser.id,
        canvasId,
        sourceCanvasNodeId,
        accessToken,
      ),
    );
  },
};
