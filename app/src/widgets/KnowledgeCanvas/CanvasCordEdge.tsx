/**
 * [INPUT]: 依赖 @xyflow/react EdgeProps/EdgeLabelRenderer/useInternalNode、CanvasFlowEdge/CanvasFlowNode、共享 Cord/矩形射线几何、设计系统图标与 canvasActions
 * [OUTPUT]: 对外提供 CanvasCordEdge 动态浮动 Cord/承担整线 hover 的宽命中区、canvasFloatingCurve 纯几何适配器，以及支持整线悬浮/中点悬浮/点击保持/键盘聚焦的 CanvasEdgeReasonInspector 完整理由检查器与删除入口
 * [POS]: KnowledgeCanvas 的关系交互层；每次节点移动都从两张卡片的真实中心连线求边界交点，彻底绕过固定左右 Handle 坐标；线本身是指向面，中点标记只是它常驻可见的把手与键盘入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  EdgeLabelRenderer,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { useId, useState, type CSSProperties } from "react";

import type {
  CanvasFlowEdge,
  CanvasFlowNode,
} from "../../pages/canvasPresentation";
import { InfoIcon, TrashIcon } from "../../shared/design-system/icons";
import { Cord } from "../Cord";
import {
  cordCurveBetween,
  type CordBox,
  type CordCurve,
} from "../cordGeometry";
import { useCanvasActions } from "./canvasActions";

/** 端点是坐标而非矩形，故给 Cord 一个零尺寸盒: 边缘锚点退化为该点本身 */
const pointBox = (x: number, y: number) => ({ height: 0, width: 0, x, y });

type CanvasNodeGeometry = {
  height?: number;
  internals: { positionAbsolute: { x: number; y: number } };
  measured: { height?: number; width?: number };
  width?: number;
};

type CanvasEdgeFallback = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

const canvasNodeBox = (
  node: CanvasNodeGeometry | undefined,
): CordBox | null => {
  const width = node?.measured.width ?? node?.width;
  const height = node?.measured.height ?? node?.height;
  const x = node?.internals.positionAbsolute.x;
  const y = node?.internals.positionAbsolute.y;
  if (
    width === undefined
    || height === undefined
    || x === undefined
    || y === undefined
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || !Number.isFinite(x)
    || !Number.isFinite(y)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }
  return { height, width, x, y };
};

/**
 * React Flow 的 Handle 只保留图关系注册职责，真实端点由两个节点中心的射线与
 * 各自矩形边界求交。节点拖到任意象限时，端点因此会自然切换到上/右/下/左边。
 */
export const canvasFloatingCurve = (
  sourceNode: CanvasNodeGeometry | undefined,
  targetNode: CanvasNodeGeometry | undefined,
  fallback: CanvasEdgeFallback,
): CordCurve => {
  const sourceBox = canvasNodeBox(sourceNode);
  const targetBox = canvasNodeBox(targetNode);
  return sourceBox !== null && targetBox !== null
    ? cordCurveBetween(sourceBox, targetBox, { mode: "radial" })
    : cordCurveBetween(
      pointBox(fallback.sourceX, fallback.sourceY),
      pointBox(fallback.targetX, fallback.targetY),
      { mode: "radial" },
    );
};

type CanvasEdgeReasonInspectorProps = {
  createdBy: "ai" | "user";
  /** 整条关系线正被指向: 线是对象本身, 中点标记只是它的把手 */
  lineHovered?: boolean;
  onRemove: () => void;
  rationale: string | null;
  selected?: boolean;
  style?: CSSProperties;
};

export function CanvasEdgeReasonInspector({
  createdBy,
  lineHovered = false,
  onRemove,
  rationale,
  selected = false,
  style,
}: CanvasEdgeReasonInspectorProps) {
  const detailsId = `canvas-edge-reason-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const normalizedRationale = rationale?.trim() ?? "";
  const showDetails = expanded || hovered || lineHovered || selected;
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
  source,
  sourceX,
  sourceY,
  target,
  targetX,
  targetY,
}: EdgeProps<CanvasFlowEdge>) {
  const actions = useCanvasActions();
  const sourceNode = useInternalNode<CanvasFlowNode>(source);
  const targetNode = useInternalNode<CanvasFlowNode>(target);
  const [lineHovered, setLineHovered] = useState(false);
  const rationale = data?.rationale?.trim() ?? "";
  const createdBy = data?.createdBy ?? "user";
  const curve = canvasFloatingCurve(sourceNode, targetNode, {
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <Cord
        from={pointBox(curve.from.x, curve.from.y)}
        mode="radial"
        taper="both"
        to={pointBox(curve.to.x, curve.to.y)}
        tone="relation"
        variant="solid"
      />
      {/*
        命中区是这条关系的真实指向面: 理由不要求用户先找到中点那个小标记, 落在
        线上任意一处就能读到。离开时如果指针正走向中点标记(它渲染在另一个 DOM
        层), 就不要熄灭, 否则交接的那一帧会闪一下。
      */}
      <path
        className="canvas-edge-hit"
        d={curve.d}
        fill="none"
        onMouseEnter={() => setLineHovered(true)}
        onMouseLeave={(event) => {
          const next = event.relatedTarget;
          if (
            next instanceof Element
            && next.closest(".canvas-edge-inspector") !== null
          ) {
            return;
          }
          setLineHovered(false);
        }}
        stroke="transparent"
        strokeWidth={18}
      />
      <EdgeLabelRenderer>
        <CanvasEdgeReasonInspector
          createdBy={createdBy}
          lineHovered={lineHovered}
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
