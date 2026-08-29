/**
 * [INPUT]: 依赖 @xyflow/react 的 useStore（视口变换、框选进行中标志、自带成组框标志）与 canvasPresentation 的成组外接框判据
 * [OUTPUT]: 对外提供 CanvasSelectionBounds，在 React Flow 自带 NodesSelection 缺席的两段时间补上同一个成组外接框
 * [POS]: KnowledgeCanvas 的选择反馈层；矩形判据住在 canvasPresentation，这里只把它放进视口坐标系，纯视觉、不接收指针、不读写图数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useStore } from "@xyflow/react";

import {
  canvasGroupSelectionBounds,
  type CanvasFlowNode,
} from "../../pages/canvasPresentation";

type CanvasSelectionBoundsProps = {
  nodes: readonly CanvasFlowNode[];
};

export function CanvasSelectionBounds({ nodes }: CanvasSelectionBoundsProps) {
  /*
   * 与 React Flow 自带 NodesSelection 逐字同一条变换公式, 线也来自同一个 CSS
   * 变量。两个框因此共用一套坐标和一套描边: 松手那一刻框只是换了主人, 不移动、
   * 不改粗细、不闪。选择器返回字符串, 平移缩放按值比较, 不会因新对象白白重渲。
   */
  const transform = useStore((state) => `translate(${state.transform[0]}px,${
    state.transform[1]}px) scale(${state.transform[2]})`);
  const marqueeActive = useStore((state) => state.userSelectionActive);
  const ownGroupBoxVisible = useStore((state) => state.nodesSelectionActive);
  const bounds = canvasGroupSelectionBounds(nodes, {
    marqueeActive,
    ownGroupBoxVisible,
  });
  if (bounds === null) return null;

  return (
    <div className="canvas-selection-bounds" style={{ transform }}>
      <div
        className="canvas-selection-bounds-rect"
        style={{
          height: bounds.height,
          transform: `translate(${bounds.x}px,${bounds.y}px)`,
          width: bounds.width,
        }}
      />
    </div>
  );
}
