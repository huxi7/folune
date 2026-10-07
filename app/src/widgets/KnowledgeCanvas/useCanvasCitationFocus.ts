/**
 * [INPUT]: 依赖当前 React Flow 实例与引用定位事件
 * [OUTPUT]: 提供引用触发的卡片居中导航
 * [POS]: Canvas 的纯查看适配层；不移动节点、不覆盖手势选择、不提交 viewport
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, type RefObject } from "react";
import { CANVAS_CITATION_FOCUS } from "../AgentPanel/canvasCitationFocus";
type View = {
  getNode(id: string): unknown;
  fitView(options: {
    nodes: { id: string }[];
    duration: number;
    padding: number;
    maxZoom: number;
  }): Promise<boolean>;
};
export function useCanvasCitationFocus(
  canvasId: string,
  instance: RefObject<View | null>,
) {
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (
        event as CustomEvent<{ canvasId: string; nodeId: string }>
      ).detail;
      if (
        detail?.canvasId !== canvasId ||
        !instance.current?.getNode(detail.nodeId)
      )
        return;
      void instance.current.fitView({
        nodes: [{ id: detail.nodeId }],
        padding: 0.6,
        maxZoom: 1,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 180,
      });
    };
    window.addEventListener(CANVAS_CITATION_FOCUS, handle);
    return () => window.removeEventListener(CANVAS_CITATION_FOCUS, handle);
  }, [canvasId, instance]);
}
