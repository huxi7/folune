/**
 * [INPUT]: 依赖 React Flow 的 domNode/nodeLookup、浏览器指针生命周期与 CanvasManipulationBorder
 * [OUTPUT]: 对外提供 CanvasManipulationFeedback；按下可搬动对象时向该次手势涉及的卡片挂载边缘，释放/取消即卸载
 * [POS]: React Flow 内的纯 UI 手势反馈层；选择与几何只读 Flow，Portal 不包裹节点、不拦截事件、不写入 Store/WAL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useStore, useStoreApi } from "@xyflow/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CanvasManipulationBorder } from "./CanvasManipulationBorder";

export function CanvasManipulationFeedback() {
  const root = useStore((state) => state.domNode);
  const store = useStoreApi();
  const [targets, setTargets] = useState<HTMLElement[]>([]);

  useEffect(() => {
    if (!root) return;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    let pointerId: number | null = null;
    let spacePressed = false;

    const finish = () => {
      if (pointerId === null) return;
      pointerId = null;
      setTargets([]);
    };
    const release = (event: PointerEvent) => {
      if (event.pointerId === pointerId) finish();
    };
    const start = (event: PointerEvent) => {
      if (pointerId !== null || event.button !== 0 || event.isPrimary === false
        || spacePressed || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      if (!element || element.closest(
        ".nodrag, .react-flow__handle, button, input, textarea, select, a, [contenteditable='true']",
      )) return;
      const state = store.getState();
      if (state.paneDragging || state.userSelectionActive || state.connection.inProgress) return;
      const nodeElement = element.closest<HTMLElement>(".react-flow__node");
      const node = state.nodeLookup.get(nodeElement?.dataset.id ?? "");
      const group = element.closest(".react-flow__nodesselection-rect");
      if (!node && !group) return;
      if (node && !(node.draggable ?? state.nodesDraggable)) return;

      const ids = new Set([...state.nodeLookup.values()]
        .filter((candidate) => (candidate.draggable ?? state.nodesDraggable)
          && (node && !node.selected ? candidate.id === node.id : candidate.selected))
        .map((candidate) => candidate.id));
      const cards = [...root.querySelectorAll<HTMLElement>(".canvas-card[data-canvas-card-id]")]
        .filter((card) => ids.has(card.dataset.canvasCardId ?? ""));
      if (cards.length === 0) return;
      pointerId = event.pointerId;
      setTargets(cards);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed = true;
      if (event.key === "Escape") finish();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed = false;
    };
    const blur = () => { spacePressed = false; finish(); };
    const visibility = () => { if (doc.hidden) blur(); };
    // 捕获阶段只观察手势；不抢 pointer capture，不妨碍 Flow 的拖动与连接。
    root.addEventListener("pointerdown", start, true);
    view.addEventListener("pointerup", release, true);
    view.addEventListener("pointercancel", release, true);
    root.addEventListener("lostpointercapture", release, true);
    view.addEventListener("blur", blur);
    doc.addEventListener("visibilitychange", visibility);
    doc.addEventListener("keydown", keyDown, true);
    doc.addEventListener("keyup", keyUp, true);
    return () => {
      root.removeEventListener("pointerdown", start, true);
      view.removeEventListener("pointerup", release, true);
      view.removeEventListener("pointercancel", release, true);
      root.removeEventListener("lostpointercapture", release, true);
      view.removeEventListener("blur", blur);
      doc.removeEventListener("visibilitychange", visibility);
      doc.removeEventListener("keydown", keyDown, true);
      doc.removeEventListener("keyup", keyUp, true);
    };
  }, [root, store]);

  return targets.map((card) => createPortal(
    <CanvasManipulationBorder />, card, card.dataset.canvasCardId,
  ));
}
