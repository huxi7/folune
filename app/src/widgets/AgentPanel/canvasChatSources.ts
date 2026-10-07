/**
 * [INPUT]: 依赖画布文档、消息快照与 memo tree
 * [OUTPUT]: 提供问答来源选择、恢复与画布 @候选纯函数
 * [POS]: 聊天来源和画布手势选择分别拥有状态，只在显式命令时复制
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CanvasDetail } from "../../shared/api/canvas";
import type { CanvasChatScope } from "../../shared/api/canvasChat";
import type { FoluneUIMessage } from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import type { MentionResult } from "./MentionMenu";

export type CanvasComposerSource = {
  id: string;
  title: string;
  mode: "all" | "selected";
  memoIds: string[];
};
export function restoreCanvasSource(
  messages: readonly FoluneUIMessage[],
): CanvasComposerSource | null {
  const message = messages.findLast((m) => m.role === "user");
  const snapshot = message?.metadata?.context_snapshot?.canvas;
  const canvas = snapshot ?? message?.metadata?.context?.canvas;
  return canvas
    ? {
        id: canvas.canvas_id,
        title: snapshot?.title ?? message?.metadata?.canvas_title ?? "Canvas",
        mode: canvas.mode,
        memoIds: canvas.memo_ids,
      }
    : null;
}
export function canvasMentionResults(
  tree: readonly MemoTreeNode[],
  query: string,
): MentionResult[] {
  const result: MentionResult[] = [];
  const visit = (nodes: readonly MemoTreeNode[], path: string) => {
    for (const node of nodes) {
      if (node.node_type === "folder")
        visit(node.children, `${path}/${node.title}`);
      if (
        node.node_type === "canvas" &&
        (!query ||
          query === "画布" ||
          query.toLowerCase() === "canvas" ||
          node.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      )
        result.push({
          id: node.id,
          title: node.title,
          path,
          revision: node.revision,
          kind: "canvas",
        });
    }
  };
  visit(tree, "");
  return result.slice(0, 8);
}
export function freezeCanvasSource(
  source: CanvasComposerSource,
  detail: CanvasDetail,
): CanvasChatScope {
  if (detail.canvas.node_id !== source.id)
    throw new Error("画布来源尚未就绪。");
  const ids = new Set(
    detail.nodes
      .filter((n) => n.target && !n.target.deleted_at)
      .map((n) => n.target_node_id),
  );
  if (
    source.mode === "selected" &&
    (!source.memoIds.length || source.memoIds.some((id) => !ids.has(id)))
  )
    throw new Error("请重新选择可用的笔记来源。");
  return {
    canvas_id: source.id,
    mode: source.mode,
    memo_ids: [...source.memoIds],
    version: detail.canvas.version,
  };
}
export function canvasTurnIsReadOnly(
  messages: readonly FoluneUIMessage[],
): boolean {
  const user = messages.findLast((m) => m.role === "user");
  return Boolean(
    user?.metadata?.context?.canvas || user?.metadata?.context_snapshot?.canvas,
  );
}
