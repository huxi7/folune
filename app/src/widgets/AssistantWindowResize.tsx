/**
 * [INPUT]: 依赖当前窗口矩形、可视区域边界、assistantGeometry 纯裁决与宿主的 MotionValue 更新/提交命令
 * [OUTPUT]: 对外提供四边四角的原生窗口调整命中区；指针逐帧只更新局部几何，松手才提交偏好；方向键调整，Escape/取消恢复起点
 * [POS]: widgets 的助手专属窗口操控器；不用文件树的细蓝线，保留对边、最小可用尺寸和视口边界，不读取会话或业务 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useLocale } from "../shared/locale";
import { constrainAssistantRect, resizeAssistantRect, type AssistantRect, type AssistantResizeBounds, type AssistantResizeEdge } from "./assistantGeometry";

type Props = {
  bounds: AssistantResizeBounds;
  readRect: () => AssistantRect;
  onStart: () => void;
  onChange: (rect: AssistantRect) => void;
  onCommit: (rect: AssistantRect) => void;
};
const EDGES: AssistantResizeEdge[] = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
const LABELS = { n: ["上边缘", "top edge"], s: ["下边缘", "bottom edge"], e: ["右边缘", "right edge"], w: ["左边缘", "left edge"], nw: ["左上角", "top left corner"], ne: ["右上角", "top right corner"], sw: ["左下角", "bottom left corner"], se: ["右下角", "bottom right corner"] } as const;
const KEYBOARD_STEP = 8;
type Drag = { edge: AssistantResizeEdge; pointerId: number; x: number; y: number; start: AssistantRect; last: AssistantRect; handle: HTMLButtonElement };

export function AssistantWindowResize(props: Props) {
  const { t } = useLocale();
  const active = useRef<Drag | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const finish = useCallback((commit: boolean) => {
    const drag = active.current;
    if (!drag) return;
    active.current = null;
    document.documentElement.removeAttribute("data-assistant-resizing");
    if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
    if (commit) latest.current.onCommit(drag.last);
    else latest.current.onChange(drag.start);
  }, []);

  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !active.current) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    document.addEventListener("keydown", cancel, true);
    return () => { document.removeEventListener("keydown", cancel, true); finish(false); };
  }, [finish]);

  const start = (event: PointerEvent<HTMLButtonElement>, edge: AssistantResizeEdge) => {
    if (!event.isPrimary || event.button !== 0 || active.current) return;
    event.preventDefault();
    event.stopPropagation();
    props.onStart();
    const rect = constrainAssistantRect(props.readRect(), props.bounds);
    props.onChange(rect);
    active.current = { edge, start: rect, last: rect, x: event.clientX, y: event.clientY, pointerId: event.pointerId, handle: event.currentTarget };
    document.documentElement.setAttribute("data-assistant-resizing", edge);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = active.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = resizeAssistantRect(drag.start, drag.edge, event.clientX - drag.x, event.clientY - drag.y, props.bounds);
    active.current = { ...drag, last: rect };
    props.onChange(rect);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>, edge: AssistantResizeEdge) => {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const step = KEYBOARD_STEP * (event.shiftKey ? 4 : 1);
    props.onStart();
    const rect = resizeAssistantRect(constrainAssistantRect(props.readRect(), props.bounds), edge, event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0, props.bounds);
    props.onChange(rect);
    props.onCommit(rect);
  };
  return EDGES.map(edge => <button
    key={edge}
    type="button"
    aria-label={t(`调整 AI 窗口${LABELS[edge][0]}`, `Resize AI window ${LABELS[edge][1]}`)}
    className="assistant-window-resize"
    data-edge={edge}
    onPointerDown={event => start(event, edge)}
    onPointerMove={move}
    onPointerUp={event => { if (active.current?.pointerId === event.pointerId) finish(true); }}
    onPointerCancel={event => { if (active.current?.pointerId === event.pointerId) finish(false); }}
    onLostPointerCapture={event => { if (active.current?.pointerId === event.pointerId) finish(true); }}
    onKeyDown={event => key(event, edge)}
  />);
}
