/**
 * [INPUT]: 依赖 useLocale 的界面文案（用户内容保留原文）；依赖 PresenceSurface 的顶部关系说明入退场与 CSS 独立居中定位、 @xyflow/react、CanvasFlowEdge UI-only motionState、共享 Cord draw/矩形射线几何、设计系统图标与 canvasActions
 * [OUTPUT]: 对外提供可由本地 receipt 单次绘制的动态浮动 Cord、整线命中区、几何适配器与理由检查/删除入口
 * [POS]: KnowledgeCanvas 的关系交互层；每次节点移动都从两张卡片的真实中心连线求边界交点，彻底绕过固定左右 Handle 坐标；线本身是指向面，中点标记只是它常驻可见的把手与键盘入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useLocale } from "../../shared/locale";
import { PresenceSurface } from "../../shared/design-system/components/PresenceSurface";
import { useDismissable } from "../../shared/design-system/useDismissable";
import {
  EdgeLabelRenderer,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";

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

/*
 * 卡片的可见圆角 = knowledge-canvas.css 里 .canvas-card 的 --radius-panel(16px)。
 * 端点必须按这个圆角求交, 否则朝对角方向时它会落在被圆角削掉的那个尖角上, 露出
 * 悬空的一小截。native 空间文字没有表面, 保持尖角 bbox。
 */
const MEMO_CARD_CORNER_RADIUS = 16;

type CanvasNodeGeometry = {
  data?: { kind?: string };
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
  return {
    height,
    radius: node?.data?.kind === "memo_ref" ? MEMO_CARD_CORNER_RADIUS : 0,
    width,
    x,
    y,
  };
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
  const { t } = useLocale();
  const detailsId = `canvas-edge-reason-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /*
   * 这个说明有**四条**独立理由可以撑开它：指针在把手上、键盘焦点在把手上、指针在
   * 关系线上（命中区 18px 宽，把手就长在它上面）、以及点一下钉住。只用其中几条时
   * 「点旁边收起」经常不生效——那一下落在线上，线的那条仍然成立，于是看着像卡住。
   * 所以消散必须一次收掉全部四条，且**焦点必须与悬浮分开**：焦点不是一个可以随手
   * 清掉的开关，Escape 会把焦点归还给把手，若焦点直接算作"悬浮"，归还的那一刻它就
   * 自己重新打开，Escape 等于没按。线的那条用"压制"而不是清空——清了它，指针仍在
   * 线上也不会重新触发 enter，说明会一直不回来；压到指针真正离开线为止。
   * 消散走共享 useDismissable（外部 pointerdown + Escape + 焦点归还），
   * 与 Select/菜单同一条协议；Escape 分支的 preventDefault 同时给壳层守卫让行。
   */
  const [lineSuppressed, setLineSuppressed] = useState(false);
  useEffect(() => {
    if (!lineHovered) setLineSuppressed(false);
  }, [lineHovered]);
  const dismiss = useCallback(() => {
    setExpanded(false);
    setFocused(false);
    setHovered(false);
    setLineSuppressed(true);
  }, []);
  const normalizedRationale = rationale?.trim() ?? "";
  const showDetails = expanded || hovered || focused
    || (lineHovered && !lineSuppressed) || selected;
  useDismissable({
    focusRef: triggerRef,
    onDismiss: dismiss,
    open: showDetails,
    shellRef,
  });
  const relationKind = createdBy === "ai" ? t("AI 关联理由", "AI connection rationale") : t("手工关联", "Manual connection");
  const reason = normalizedRationale.length === 0
    ? createdBy === "ai"
      ? t("这条 AI 关系暂时没有可用的说明。", "No explanation is available for this AI connection yet.")
      : t("这条关系由你手动建立。", "You created this connection manually.")
    : normalizedRationale;

  return (
    <div
      className="canvas-edge-inspector nodrag nopan"
      data-open={showDetails}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onFocus={() => setFocused(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={shellRef}
      style={style}
    >
      <button
        aria-controls={detailsId}
        aria-expanded={showDetails}
        aria-label={t(`查看${relationKind}`, `View ${relationKind}`)}
        className="canvas-edge-reason-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
        ref={triggerRef}
        title={t(`查看${relationKind}`, `View ${relationKind}`)}
        type="button"
      >
        <InfoIcon aria-hidden size={14} />
      </button>
      <PresenceSurface open={showDetails} placement="top"
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
            aria-label={t("删除关系", "Remove connection")}
            className="canvas-edge-delete"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            title={t("删除关系", "Remove connection")}
            type="button"
          >
            <TrashIcon size={14} />
          </button>
      </PresenceSurface>
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
        draw={data?.motionState?.kind === "edge-draw"}
        drawDelayMs={data?.motionState?.delayMs ?? 0}
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
