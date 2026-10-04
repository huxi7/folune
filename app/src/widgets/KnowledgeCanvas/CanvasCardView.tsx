/**
 * [INPUT]: 依赖 WarmTooltip 原位功能提示；依赖 useLocale 的界面文案（用户内容保留原文）；依赖 @xyflow/react、motion/react、workspaceMotion spatialSpring、CanvasFlowNode UI-only motionState、NotePaper（纸面身份由它命名壳与正文）、空间文字几何、设计系统图标、稳定 canvasActions 与显式交互状态
 * [OUTPUT]: 对外提供无业务 Store 的 CanvasCardView，可按本地 receipt 入场且纸面可飞向 Preview 的 memo_ref 卡、底栏行尾连接抓手/整卡 target、源节点确认反馈与 1:1 拖拽/等比缩放 native 文字
 * [POS]: KnowledgeCanvas 的节点表现层；正式中心 Handle 仍只登记关系身份，底栏抓手与会话期 whole-card target 只承载直接操纵，真实正式端点继续由 CanvasCordEdge 读取节点矩形求解
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import WarmTooltip from "../../shared/design-system/components/WarmTooltip";
import { useLocale } from "../../shared/locale";
import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  type NodeProps,
} from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import {
  reducedFadeTransition,
  spatialSpring,
} from "../../pages/workspaceMotion";
import {
  ConnectionHandleIcon,
  ExpandIcon,
  ExpandFromNoteIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import { NotePaper } from "../NotePaper";
import { useCanvasActions } from "./canvasActions";
import {
  CANVAS_TEXT_DEFAULT_HEIGHT,
  CANVAS_TEXT_DEFAULT_WIDTH,
  CANVAS_TEXT_MAX_HEIGHT,
  CANVAS_TEXT_MAX_SCALE,
  CANVAS_TEXT_MAX_WIDTH,
  CANVAS_TEXT_MIN_HEIGHT,
  CANVAS_TEXT_MIN_SCALE,
  CANVAS_TEXT_MIN_WIDTH,
  normalizeTextGeometry,
  resizedTextScale,
  scaleTextGeometry,
  textBaseGeometry,
} from "./spatialTextGeometry";

const textResizeCorners = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

const TEXT_WRAP_TOLERANCE = 1;

const measuredTextBase = (
  element: HTMLElement | null,
  fallback: { height: number; width: number },
): { height: number; width: number } => {
  if (element === null) return fallback;
  const measuredHeight = Math.ceil(Math.max(
    element.offsetHeight,
    element.scrollHeight,
  ));
  const measuredWidth = Math.ceil(Math.max(
    element.offsetWidth,
    element.scrollWidth,
  )) + TEXT_WRAP_TOLERANCE;
  return {
    height: measuredHeight > 0
      ? Math.max(CANVAS_TEXT_MIN_HEIGHT, measuredHeight)
      : fallback.height,
    width: measuredWidth > 0
      ? Math.max(CANVAS_TEXT_MIN_WIDTH, measuredWidth)
      : fallback.width,
  };
};

export type CanvasCardViewProps = NodeProps<CanvasFlowNode> & {
  editing: boolean;
  previewing: boolean;
  aiLoading: boolean;
  connectionSourceId: string | null;
  validConnectionTarget: boolean;
};

export const CanvasCardView = memo(function CanvasCardView({
  data, height, id, selected, width,
  editing, previewing, aiLoading, connectionSourceId, validConnectionTarget,
}: CanvasCardViewProps) {
  const { t } = useLocale();
  const actions = useCanvasActions();
  const reduceMotion = Boolean(useReducedMotion());
  const [text, setText] = useState(data.body ?? "");
  const [resizingScale, setResizingScale] = useState<number | null>(null);
  const [draftBaseGeometry, setDraftBaseGeometry] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const cancelledRef = useRef(false);
  const finishingRef = useRef(false);
  const draftChangedRef = useRef(false);
  const persistedGeometry = normalizeTextGeometry({
    height: data.textHeight ?? height ?? CANVAS_TEXT_DEFAULT_HEIGHT,
    scale: data.textScale,
    width: data.textWidth ?? width ?? CANVAS_TEXT_DEFAULT_WIDTH,
  });
  const baseGeometry = textBaseGeometry(persistedGeometry);
  const finishEditing = useCallback(() => {
    if (finishingRef.current) return;
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    finishingRef.current = true;
    const natural = measuredTextBase(measureRef.current, baseGeometry);
    void actions.onCommitText(
      id,
      text,
      scaleTextGeometry(natural, persistedGeometry.scale),
    ).catch(() => {
      finishingRef.current = false;
    });
  }, [
    actions,
    baseGeometry,
    id,
    persistedGeometry.scale,
    text,
  ]);

  useEffect(() => {
    if (!editing) {
      finishingRef.current = false;
      draftChangedRef.current = false;
      setDraftBaseGeometry(null);
      setText(data.body ?? "");
    }
  }, [data.body, editing]);

  useEffect(() => {
    if (!editing) return;
    const focusEditor = () => {
      editorRef.current?.focus();
      const cursor = editorRef.current?.value.length ?? 0;
      editorRef.current?.setSelectionRange(cursor, cursor);
    };
    focusEditor();
    const timer = window.setTimeout(focusEditor, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    const finishEditingOutside = (event: PointerEvent) => {
      const editor = editorRef.current;
      if (editor !== null && !event.composedPath().includes(editor)) {
        if (document.activeElement === editor) editor.blur();
        else finishEditing();
      }
    };
    window.addEventListener("pointerdown", finishEditingOutside, true);
    return () => window.removeEventListener(
      "pointerdown",
      finishEditingOutside,
      true,
    );
  }, [editing, finishEditing]);

  useLayoutEffect(() => {
    if (!editing || data.kind !== "native" || !draftChangedRef.current) return;
    const measured = measuredTextBase(measureRef.current, {
      height: baseGeometry.height,
      width: baseGeometry.width,
    });
    setDraftBaseGeometry((current) =>
      current?.height === measured.height && current.width === measured.width
        ? current
        : measured);
  }, [baseGeometry.height, baseGeometry.width, data.kind, editing, text]);

  if (data.kind === "native") {
    const activeScale = resizingScale ?? persistedGeometry.scale;
    const activeBaseGeometry = editing && draftBaseGeometry !== null
      ? draftBaseGeometry
      : baseGeometry;
    const surfaceStyle = {
      height: activeBaseGeometry.height,
      transform: `scale(${activeScale})`,
      width: activeBaseGeometry.width,
    } satisfies CSSProperties;

    return (
      <article
        className="canvas-text-node"
        data-editing={editing}
        data-selected={selected}
        data-text-scale={activeScale}
        onDoubleClick={(event) => {
          event.stopPropagation();
          actions.onEditText(id);
        }}
      >
        {selected && !editing ? textResizeCorners.map((position) => (
          <NodeResizeControl
            className="canvas-node-resize-handle"
            key={position}
            keepAspectRatio
            maxHeight={Math.min(
              CANVAS_TEXT_MAX_HEIGHT,
              baseGeometry.height * CANVAS_TEXT_MAX_SCALE,
            )}
            maxWidth={Math.min(
              CANVAS_TEXT_MAX_WIDTH,
              baseGeometry.width * CANVAS_TEXT_MAX_SCALE,
            )}
            minHeight={Math.max(
              CANVAS_TEXT_MIN_HEIGHT,
              baseGeometry.height * CANVAS_TEXT_MIN_SCALE,
            )}
            minWidth={Math.max(
              CANVAS_TEXT_MIN_WIDTH,
              baseGeometry.width * CANVAS_TEXT_MIN_SCALE,
            )}
            onResize={(_, parameters) => {
              setResizingScale(resizedTextScale(
                persistedGeometry.width,
                persistedGeometry.scale,
                parameters.width,
              ));
            }}
            onResizeEnd={(_, parameters) => {
              const scale = resizedTextScale(
                persistedGeometry.width,
                persistedGeometry.scale,
                parameters.width,
              );
              void actions.onResize(id, {
                height: parameters.height,
                scale,
                width: parameters.width,
                x: parameters.x,
                y: parameters.y,
              }).finally(() => setResizingScale(null));
            }}
            position={position}
            variant={ResizeControlVariant.Handle}
          />
        )) : null}
        <div className="canvas-text-surface" style={surfaceStyle}>
          {editing ? (
            <textarea
              aria-label={t("自由文字", "Text")}
              className="canvas-text-editor nodrag nowheel"
              maxLength={5000}
              onBlur={finishEditing}
              onChange={(event) => {
                draftChangedRef.current = true;
                setText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelledRef.current = true;
                  actions.onCancelText(id);
                  event.currentTarget.blur();
                }
              }}
              ref={editorRef}
              value={text}
            />
          ) : (
            <div className="canvas-text-copy">
              <span>{data.body ?? ""}</span>
            </div>
          )}
        </div>
        {editing ? (
          <span
            aria-hidden
            className="canvas-text-measure"
            ref={measureRef}
            style={{ maxWidth: CANVAS_TEXT_MAX_WIDTH / persistedGeometry.scale }}
          >
            {text.length === 0 ? "\u200b" : text}
          </span>
        ) : null}
      </article>
    );
  }

  // 目标笔记仍然可读时才提供阅读/AI/关联: 回收站与永久删除的目标读不出正文,
  // 给出一个注定报错的入口比不给更糟。
  const available = data.targetNodeId !== null
    && !data.tombstone
    && !data.targetDeleted;
  /*
   * 只剩两种状态, 而且两种都是"这张卡片指向的东西不在库里了"——用户必须知道, 也有出路
   * (移除, 或去回收站恢复)。曾经这里还有第三条「原文已更新」: 它比的是入画布那天存下的
   * revision 快照, 但卡片的标题与摘录本来就读笔记的最新内容, 所以它警告的那个不一致
   * 用户根本看不见; 又因为快照只在创建时写一次, 这行字一旦出现就永久消不掉。
   * 一个既验证不了、也处理不掉的警告只会让人以为出了故障。
   */
  const status = data.tombstone
    ? t("原笔记已被永久删除", "The original note was permanently deleted")
    : data.targetDeleted
      ? t("在回收站", "In trash")
      : "";
  const motionStyle = data.motionState === undefined
    ? undefined
    : {
      "--canvas-motion-delay": `${data.motionState.delayMs}ms`,
      "--canvas-motion-content-delay": `${data.motionState.delayMs + 120}ms`,
    } as CSSProperties;
  const nodeEntering = data.motionState?.kind === "node-enter";

  return (
    <motion.article
      animate={nodeEntering ? { opacity: 1, x: 0, y: 0 } : undefined}
      className="canvas-card"
      data-canvas-card-id={id}
      data-kind={data.kind}
      data-connection-source={connectionSourceId === id ? "true" : undefined}
      data-connection-target={validConnectionTarget ? "valid" : undefined}
      data-motion-state={data.motionState?.kind}
      data-selected={selected}
      data-tombstone={data.tombstone}
      initial={nodeEntering
        ? reduceMotion
          ? { opacity: 0 }
          : {
            opacity: 0.68,
            x: data.motionState?.offsetX ?? 0,
            y: data.motionState?.offsetY ?? 0,
          }
        : false}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (available) actions.onPreview(id);
      }}
      onFocus={() => {
        if (data.targetNodeId !== null) actions.onPrefetchMemo(data.targetNodeId);
      }}
      onPointerEnter={() => {
        if (data.targetNodeId !== null) actions.onPrefetchMemo(data.targetNodeId);
      }}
      style={motionStyle}
      transition={nodeEntering
        ? reduceMotion
          ? reducedFadeTransition
          : {
            ...spatialSpring,
            delay: (data.motionState?.delayMs ?? 0) / 1_000,
          }
        : undefined}
    >
      <Handle
        className="canvas-card-center-handle"
        isConnectable={false}
        position={Position.Left}
        type="target"
      />
      {available ? (
        <Handle
          aria-hidden="true"
          className="canvas-card-whole-target"
          id="connection-target"
          isConnectable
          isConnectableStart={false}
          position={Position.Left}
          type="target"
        />
      ) : null}

      <NotePaper
        className="canvas-card-paper"
        transitionIdentity={data.kind === "memo_ref"
          && data.targetNodeId !== null
          && data.paperTransitionActive
          && !previewing
          ? data.targetNodeId
          : null}
        emptyLabel={data.tombstone ? t("原文已不在库中", "The original note is no longer available") : t("这页还没有正文", "This page is still blank")}
        excerpt={data.body}
        overlay={available ? (
          <WarmTooltip asChild content={t("展开阅读", "Expand to read")}>
          <button
            aria-label={t(`展开阅读${data.title}`, `Read ${data.title}`)}
            className="canvas-card-expand nodrag"
            onClick={(event) => {
              event.stopPropagation();
              actions.onPreview(id);
            }}
            type="button"
          >
            <ExpandIcon size={16} />
          </button>
          </WarmTooltip>
        ) : null}
        title={data.title}
        variant="thumbnail"
      />

      {/*
        * 元信息行高度固定: 三个入口只改变透明度。抓手住在这一行的最右端而不是卡片外的
        * 右下角 —— 宪法 10.3 说柄的位置"只服从最不干扰", 而挂在角外的小凸起恰恰最干扰:
        * 它破坏这张纸完整的轮廓。行尾这个槽位不暗示任何出线方向(端点由两张卡片的中心
        * 射线求得, 与柄无关), 三个入口严格等距: 抓手不同族由点阵图标、grab 光标与 hover
        * 变 primary 表达, 用间距表达只会被读成没对齐。
        */}
      <footer className="canvas-card-meta nodrag">
        <span className="canvas-card-status">{status}</span>
        <span className="canvas-card-actions">
          {available ? (
            <WarmTooltip asChild content={t("AI 拓展", "Explore with AI")} disabled={aiLoading}>
            <button
              aria-label={t("AI 拓展这条分支", "Explore this branch with AI")}
              className="canvas-card-action"
              disabled={aiLoading}
              onClick={() => void actions.onExpand(id)}
              type="button"
            >
              <ExpandFromNoteIcon size={14} />
            </button>
            </WarmTooltip>
          ) : null}
          <WarmTooltip asChild content={t("移除", "Remove")}>
          <button
            aria-label={t("从画布移除", "Remove from canvas")}
            className="canvas-card-action"
            onClick={() => void actions.onRemove(id).catch(() => undefined)}
            type="button"
          >
            <TrashIcon size={14} />
          </button>
          </WarmTooltip>
        </span>
        {available ? (
          <WarmTooltip asChild content={t("拖到另一张卡片，或点击后再选择目标", "Drag to another card, or click then choose a target")}>
          <Handle
            aria-label={t("从这张卡片建立关系", "Connect this card")}
            className="canvas-card-connect-handle nodrag"
            id="connection-source"
            isConnectable
            isConnectableEnd={false}
            onClick={(event) => {
              event.stopPropagation();
              actions.onConnect(id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                actions.onConnect(id);
                return;
              }
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              actions.onConnect(id);
            }}
            position={Position.Right}
            role="button"
            tabIndex={0}
            type="source"
          >
            <ConnectionHandleIcon aria-hidden size={14} />
          </Handle>
          </WarmTooltip>
        ) : null}
      </footer>

      <Handle
        className="canvas-card-center-handle"
        isConnectable={false}
        position={Position.Right}
        type="source"
      />
    </motion.article>
  );
});
