/**
 * [INPUT]: 依赖 DOM CustomEvent 的标签页内通知
 * [OUTPUT]: 提供引用定位事件名与发送函数
 * [POS]: 聊天到当前 Canvas 的只读导航桥；不改变选择、坐标或持久化文档
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const CANVAS_CITATION_FOCUS = "folune:canvas-citation-focus";
export function requestCanvasCitationFocus(canvasId: string, nodeId: string) {
  window.dispatchEvent(
    new CustomEvent(CANVAS_CITATION_FOCUS, { detail: { canvasId, nodeId } }),
  );
}
