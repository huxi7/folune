/**
 * [INPUT]: 依赖 @xyflow/react EdgeProps/EdgeLabelRenderer、共享 Cord/几何、设计系统图标与 canvasActions
 * [OUTPUT]: 对外提供带宽命中区、按 hover/选中显示理由和删除入口的 CanvasCordEdge
 * [POS]: KnowledgeCanvas 的关系交互层；可见线继续复用 Cord Signature，理由不再永久铺满画布
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { useState } from "react";

import { TrashIcon } from "../../shared/design-system/icons";
import { Cord } from "../Cord";
import { cordCurveBetween } from "../cordGeometry";
import { useCanvasActions } from "./canvasActions";

/** 端点是坐标而非矩形，故给 Cord 一个零尺寸盒: 边缘锚点退化为该点本身 */
const pointBox = (x: number, y: number) => ({ height: 0, width: 0, x, y });

export function CanvasCordEdge({
  data,
  id,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const actions = useCanvasActions();
  const [hovered, setHovered] = useState(false);
  const rationale = (data as { rationale?: string | null } | undefined)?.rationale;
  const curve = cordCurveBetween(
    pointBox(sourceX, sourceY),
    pointBox(targetX, targetY),
    { mode: "radial" },
  );
  const showLabel = hovered || selected;

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
      <path
        className="canvas-edge-hit"
        d={curve.d}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        stroke="transparent"
        strokeWidth={18}
      />
      {!showLabel
        ? null
        : (
          <EdgeLabelRenderer>
            <div
              className="canvas-edge-reason"
              style={{
                transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
              }}
            >
              {rationale === null || rationale === undefined || rationale.length === 0
                ? <span>手工关联</span>
                : <span>{rationale}</span>}
              <button
                aria-label="删除关系"
                className="canvas-edge-delete"
                onClick={() => void actions.onRemoveEdge(id).catch(() => undefined)}
                type="button"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </EdgeLabelRenderer>
        )}
    </>
  );
}
