/**
 * [INPUT]: 依赖 @xyflow/react 的 EdgeProps/EdgeLabelRenderer、widgets/Cord 的 Cord 与 styles/knowledge-canvas.css
 * [OUTPUT]: 对外提供 CanvasCordEdge，把画布上的关联画成与探索态同一条 Cord
 * [POS]: KnowledgeCanvas 的连线适配层；探索态与画布态共用同一个 Cord 原语，因此「关联」在两个空间里长得一样——实线代表已写入关系表，虚线只出现在探索态那次未落库的推荐里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

import { Cord } from "../Cord";

/** 端点是坐标而非矩形，故给 Cord 一个零尺寸盒: 边缘锚点退化为该点本身 */
const pointBox = (x: number, y: number) => ({ height: 0, width: 0, x, y });

export function CanvasCordEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const rationale = (data as { rationale?: string | null } | undefined)?.rationale;

  return (
    <>
      <Cord
        from={pointBox(sourceX, sourceY)}
        mode="radial"
        taper="both"
        to={pointBox(targetX, targetY)}
        tone="relation"
        variant="solid"
      />
      {rationale === null || rationale === undefined || rationale.length === 0
        ? null
        : (
          <EdgeLabelRenderer>
            <p
              className="canvas-edge-reason"
              style={{
                transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
              }}
            >
              {rationale}
            </p>
          </EdgeLabelRenderer>
        )}
    </>
  );
}
