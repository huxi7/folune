/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、canvas DTO 输入与 RPC 结果、canvas repository、memo.service 的 nextSortOrder/memoContentData 派生规则与 HttpError
 * [OUTPUT]: 对外提供保存探索结果、读取画布、更新布局、新增摘录/原生卡片与卡片晋升五个业务用例，并把 RPC status 收敛为稳定 HTTP 错误
 * [POS]: service 层知识画布编排边界，也是唯一的授权判断层。它刻意不自己拼 SQL 事务: 原子性由 RPC 保证，此处只负责派生摘要/字数与 sort_order（两条规则的所有者都在 memo.service），并把「已晋升」如实表达为幂等成功而不是错误
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  CanvasCardRow,
  CanvasLayoutInput,
  CreateCanvasCardInput,
  CanvasLayoutRpcResult,
  PromoteCanvasNodeInput,
  PromoteCanvasNodeRpcResult,
  ReadCanvasRpcResult,
  SaveCanvasInput,
  SaveCanvasRpcResult,
} from "../dto/canvas.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  Canvas,
  CanvasCard,
  CanvasDetail,
  CanvasLayoutResult,
  CanvasPromotion,
  CanvasSaveResult,
} from "../model/canvas.model.ts";
import type { MemoContent, MemoNode } from "../model/memo.model.ts";
import { canvasRepository } from "../repository/canvas.repository.ts";
import { memoRepository } from "../repository/memo.repository.ts";
import { memoContentData, nextSortOrder } from "./memo.service.ts";

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

const requireSaved = (result: SaveCanvasRpcResult): CanvasSaveResult => {
  if (result.status === "created") {
    return {
      canvas: result.canvas as Canvas,
      card_count: result.card_count,
      node: result.node as MemoNode,
      skipped_count: result.skipped_count,
    };
  }
  if (result.status === "origin_not_found") {
    throw new HttpError(
      404,
      "CANVAS_ORIGIN_NOT_FOUND",
      "Canvas origin memo was not found",
    );
  }
  if (result.status === "parent_not_found") {
    throw parentNotFolder();
  }
  if (result.status === "invalid") {
    throw invalidCanvas(result);
  }
  throw canvasNotFound();
};

const requireDetail = (result: ReadCanvasRpcResult): CanvasDetail => {
  if (result.status !== "ok") {
    throw canvasNotFound();
  }

  return {
    canvas: result.canvas as Canvas,
    cards: result.cards as CanvasCard[],
    edges: result.edges,
    node: result.node as MemoNode,
  };
};

const requireLayout = (result: CanvasLayoutRpcResult): CanvasLayoutResult => {
  if (result.status !== "updated") {
    throw canvasNotFound();
  }

  return { canvas: result.canvas as Canvas, moved_count: result.moved_count };
};

/** 晋升后的卡片自带目标投影，前端拿到即可直接换成引用卡片，无需二次读取 */
const toPromotedCard = (
  card: CanvasCardRow,
  node: MemoNode | null,
  memo: MemoContent | null,
): CanvasCard => ({
  anchor: card.anchor,
  anchored_rev: card.anchored_rev,
  created_by: card.created_by,
  id: card.id,
  kind: card.kind,
  position_x: card.position_x,
  position_y: card.position_y,
  target: node === null ? null : {
    deleted_at: node.deleted_at,
    excerpt: memo?.excerpt ?? null,
    node_id: node.id,
    revision: node.revision,
    title: node.title,
  },
  target_node_id: card.target_node_id,
  text: card.text,
});

const requirePromotion = (
  result: PromoteCanvasNodeRpcResult,
): CanvasPromotion => {
  if (result.status === "promoted") {
    const node = result.node as MemoNode;
    const memo = result.memo as MemoContent;

    return {
      already_promoted: false,
      card: toPromotedCard(result.card, node, memo),
      memo,
      node,
    };
  }
  if (result.status === "already_promoted") {
    const node = result.node as MemoNode | null;
    const memo = result.memo as MemoContent | null;

    return {
      already_promoted: true,
      card: toPromotedCard(result.card, node, memo),
      memo,
      node,
    };
  }
  if (result.status === "parent_not_found") {
    throw parentNotFolder();
  }
  if (result.status === "invalid") {
    throw invalidCanvas(result);
  }
  throw new HttpError(404, "CANVAS_CARD_NOT_FOUND", "Canvas card was not found");
};

export const canvasService = {
  async save(
    authUser: AuthUser,
    accessToken: string,
    input: SaveCanvasInput,
  ): Promise<CanvasSaveResult> {
    const parentId = input.parent_id ?? null;

    return requireSaved(
      await canvasRepository.saveExploration(
        {
          items: input.items.map((item) => ({
            confidence: item.confidence ?? null,
            excerpt: item.excerpt ?? null,
            matched_channels: item.matched_channels ?? [],
            node_id: item.node_id,
            reason: item.reason ?? null,
            revision: item.revision ?? null,
            x: item.x ?? 0,
            y: item.y ?? 0,
          })),
          originNodeId: input.origin_node_id,
          parentId,
          sortOrder: await nextSortOrder(authUser, accessToken, parentId),
          title: input.title,
          userId: authUser.id,
          viewport: input.viewport ?? {},
        },
        accessToken,
      ),
    );
  },

  async read(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
  ): Promise<CanvasDetail> {
    return requireDetail(
      await canvasRepository.read(authUser.id, canvasId, accessToken),
    );
  },

  async updateLayout(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
    input: CanvasLayoutInput,
  ): Promise<CanvasLayoutResult> {
    return requireLayout(
      await canvasRepository.updateLayout(
        {
          canvasId,
          cards: input.cards ?? [],
          userId: authUser.id,
          viewport: input.viewport ?? null,
        },
        accessToken,
      ),
    );
  },

  /**
 * 往画布上新增一张摘录/原生卡片。这是晋升的唯一入口来源: 没有它，
 * 「画布节点晋升为笔记」就永远没有可晋升的对象。
 */
  async createCard(
    authUser: AuthUser,
    accessToken: string,
    canvasId: string,
    input: CreateCanvasCardInput,
  ): Promise<CanvasCard> {
    const canvas = await canvasRepository.findCanvasNodeId(
      authUser.id,
      canvasId,
      accessToken,
    );

    if (canvas === null) {
      throw canvasNotFound();
    }

    let target: MemoNode | null = null;

    if (input.kind === "excerpt") {
      target = await memoRepository.findActiveNodeById(
        authUser.id,
        input.source_node_id as string,
        accessToken,
      );

      if (target === null || target.node_type !== "memo") {
        throw new HttpError(404, "MEMO_NOT_FOUND", "Memo was not found");
      }
    }

    const card = await canvasRepository.createCard(
      {
        anchor: input.anchor ?? {},
        anchored_rev: input.anchored_rev ?? target?.revision ?? null,
        canvas_id: canvasId,
        created_by: "user",
        kind: input.kind,
        position_x: input.x ?? 0,
        position_y: input.y ?? 0,
        target_node_id: target?.id ?? null,
        text: input.text,
        user_id: authUser.id,
      },
      accessToken,
    );

    return toPromotedCard(card, target, null);
  },

  async promote(
    authUser: AuthUser,
    accessToken: string,
    cardId: string,
    input: PromoteCanvasNodeInput,
  ): Promise<CanvasPromotion> {
    const card = await canvasRepository.findCardText(
      authUser.id,
      cardId,
      accessToken,
    );

    if (card === null) {
      throw new HttpError(
        404,
        "CANVAS_CARD_NOT_FOUND",
        "Canvas card was not found",
      );
    }

    // 摘要与字数从同一段正文派生（规则的所有者在 memo.service）；标题的首行回退
    // 留给 RPC，那样「怎么起名」也只有一处实现。
    const derived = memoContentData(card.text ?? "");
    const parentId = input.parent_id ?? null;

    return requirePromotion(
      await canvasRepository.promote(
        {
          cardId,
          excerpt: derived.excerpt,
          parentId,
          sortOrder: await nextSortOrder(authUser, accessToken, parentId),
          title: input.title ?? null,
          userId: authUser.id,
          wordCount: derived.word_count,
        },
        accessToken,
      ),
    );
  },
};
