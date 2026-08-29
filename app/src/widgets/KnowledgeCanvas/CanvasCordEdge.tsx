/**
 * [INPUT]: 依赖 @xyflow/react EdgeProps/EdgeLabelRenderer、CanvasFlowEdge 人工/AI 来源、共享 Cord/几何、设计系统图标与 canvasActions
 * [OUTPUT]: 对外提供 CanvasCordEdge 中心连心 Cord/宽命中区，以及可独立验证、支持悬浮预览/点击保持/键盘聚焦的 CanvasEdgeReasonInspector 完整理由检查器与删除入口
 * [POS]: KnowledgeCanvas 的关系交互层；可见线继续复用 Cord Signature，节点中心间的内部线段由卡片表面遮住，关系中点以安静圆点保证人工与 AI 理由始终可发现且可读
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { useId, useState, type CSSProperties } from "react";

import type { CanvasFlowEdge } from "../../pages/canvasPresentation";
import { InfoIcon, TrashIcon } from "../../shared/design-system/icons";
import { Cord } from "../Cord";
import { cordCurveBetween } from "../cordGeometry";
import { useCanvasActions } from "./canvasActions";

/** 端点是坐标而非矩形，故给 Cord 一个零尺寸盒: 边缘锚点退化为该点本身 */
const pointBox = (x: number, y: number) => ({ height: 0, width: 0, x, y });

type CanvasEdgeReasonInspectorProps = {
  createdBy: "ai" | "user";
  onRemove: () => void;
  rationale: string | null;
  selected?: boolean;
  style?: CSSProperties;
};

export function CanvasEdgeReasonInspector({
  createdBy,
  onRemove,
  rationale,
  selected = false,
  style,
}: CanvasEdgeReasonInspectorProps) {
  const detailsId = `canvas-edge-reason-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const normalizedRationale = rationale?.trim() ?? "";
  const showDetails = expanded || hovered || selected;
  const relationKind = createdBy === "ai" ? "AI 关联理由" : "手工关联";
  const reason = normalizedRationale.length === 0
    ? createdBy === "ai"
      ? "这条 AI 关系暂时没有可用的说明。"
      : "这条关系由你手动建立。"
    : normalizedRationale;

  return (
    <div
      className="canvas-edge-inspector nodrag nopan"
      data-open={showDetails}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
      onFocus={() => setHovered(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      <button
        aria-controls={detailsId}
        aria-expanded={showDetails}
        aria-label={`查看${relationKind}`}
        className="canvas-edge-reason-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
        title={`查看${relationKind}`}
        type="button"
      >
        <InfoIcon aria-hidden size={14} />
      </button>
      {showDetails ? (
        <div
          aria-label={relationKind}
          className="canvas-edge-reason"
          id={detailsId}
          role="note"
        >
          <span className="canvas-edge-reason-copy">
            <small>{relationKind}</small>
            <span>{reason}</span>
          </span>
          <button
            aria-label="删除关系"
            className="canvas-edge-delete"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            title="删除关系"
            type="button"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CanvasCordEdge({
  data,
  id,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<CanvasFlowEdge>) {
  const actions = useCanvasActions();
  const rationale = data?.rationale?.trim() ?? "";
  const createdBy = data?.createdBy ?? "user";
  const curve = cordCurveBetween(
    pointBox(sourceX, sourceY),
    pointBox(targetX, targetY),
    { mode: "radial" },
  );

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
        stroke="transparent"
        strokeWidth={18}
      />
      <EdgeLabelRenderer>
        <CanvasEdgeReasonInspector
          createdBy={createdBy}
          onRemove={() => void actions.onRemoveEdge(id).catch(() => undefined)}
          rationale={rationale}
          selected={selected}
          style={{
            transform: `translate(-50%, -50%) translate(${curve.mid.x}px, ${curve.mid.y}px)`,
          }}
        />
      </EdgeLabelRenderer>
    </>
  );
}
