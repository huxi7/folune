/**
 * [INPUT]: 依赖 Canvas 可信读取、消息冻结范围与 HttpError
 * [OUTPUT]: 提供画布问答快照；校验版本、范围和可读节点
 * [POS]: service 的只读图投影；快照不包含笔记正文，不推导连线语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { HttpError } from "../common/http-error.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { CanvasDetailV2 } from "../model/canvas.model.ts";
import type {
  CanvasChatScope,
  CanvasChatSnapshot,
} from "../model/canvas-chat.model.ts";
import { canvasService } from "./canvas.service.ts";

export function projectCanvasChat(
  detail: CanvasDetailV2,
  scope: CanvasChatScope,
): CanvasChatSnapshot {
  if (
    detail.canvas.node_id !== scope.canvas_id ||
    detail.canvas.version !== scope.version
  ) {
    throw new HttpError(409, "AI_CANVAS_STALE", "画布已变化，请重新发送。");
  }
  const requested = new Set(scope.memo_ids);
  const available = detail.nodes.filter(
    (n) => n.kind === "memo_ref" && n.target && n.target.deleted_at === null,
  );
  if (
    scope.mode === "selected" &&
    (!requested.size ||
      [...requested].some(
        (id) => !available.some((n) => n.target_node_id === id),
      ))
  ) {
    throw new HttpError(
      409,
      "AI_CANVAS_SOURCE_MISSING",
      "所选笔记已不可用，请重新选择。",
    );
  }
  const nodes = detail.nodes.filter((n) =>
    n.kind === "native"
      ? scope.mode === "all"
      : available.includes(n) &&
        (scope.mode === "all" || requested.has(n.target_node_id!)),
  );
  const ids = new Set(nodes.map((n) => n.id));
  return {
    ...scope,
    memo_ids: scope.mode === "all" ? [] : [...requested],
    title: detail.node.title,
    nodes: nodes.map((n) => ({
      id: n.id,
      memo_id: n.target_node_id,
      title: n.target?.title ?? "画布文字",
      revision: n.target?.revision ?? null,
      text: n.text,
      excerpt: n.target?.excerpt ?? null,
    })),
    edges: detail.edges.filter(
      (e) => ids.has(e.source_id) && ids.has(e.target_id),
    ),
  };
}

export const resolveCanvasChat = async (
  user: AuthUser,
  token: string,
  scope: CanvasChatScope,
) =>
  projectCanvasChat(
    await canvasService.read(user, token, scope.canvas_id),
    scope,
  );
