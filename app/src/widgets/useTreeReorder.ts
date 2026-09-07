/**
 * [INPUT]: 依赖 tree 容器、结构身份、共享 FLIP 曲线和归档运动租约
 * [OUTPUT]: 对外提供 useTreeReorder 与手势前捕获入口，仅结构变化播放行位移
 * [POS]: AppSidebar 的重排视觉层；展开高度归 TreeDisclosure，ResizeObserver 只更新快照，不触发二次 FLIP
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { treeFlipDurationMs, treeFlipEasing } from "../pages/workspaceMotion";
import { beginArchiveMotion, endArchiveMotion } from "./archiveCordMotion";
export function useTreeReorder(treeRef: RefObject<HTMLDivElement | null>, layoutKey: string) {
  const flipSnapshotRef = useRef<Map<string, DOMRect> | null>(null);
  const previousLayoutRef = useRef<Map<string, DOMRect> | null>(null);
  useLayoutEffect(() => {
    if (treeRef.current === null) {
      return;
    }

    const currentLayout = new Map<string, DOMRect>();
    const rows = treeRef.current.querySelectorAll<HTMLElement>(
      "[data-memo-tree-row-id]",
    );

    rows.forEach((row) => {
      const nodeId = row.dataset["memoTreeRowId"];

      if (nodeId !== undefined) {
        currentLayout.set(nodeId, row.getBoundingClientRect());
      }
    });

    const snapshot = flipSnapshotRef.current ?? previousLayoutRef.current;
    flipSnapshotRef.current = null;
    previousLayoutRef.current = currentLayout;

    if (
      snapshot === null ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const animations: Animation[] = [];

    rows.forEach((row) => {
      const nodeId = row.dataset["memoTreeRowId"];
      const previous = nodeId === undefined ? undefined : snapshot.get(nodeId);

      if (previous === undefined) {
        return;
      }

      const current = nodeId === undefined ? undefined : currentLayout.get(nodeId);

      if (current === undefined) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        return;
      }

      animations.push(row.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: treeFlipDurationMs,
          easing: treeFlipEasing,
        },
      ));
    });

    if (animations.length === 0) {
      return;
    }

    /*
     * FLIP 是 transform 动画: ResizeObserver 看不见它, 也没有 transitionend。
     * 归档线要在这段时间里逐帧读到行的真实 transform 后 rect, 只能由发起动画的这一方
     * 明确交出一段租约, 并在真的结束时归还 —— 猜结尾等于让线晚一帧到位。
     */
    beginArchiveMotion("tree-flip");
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      endArchiveMotion("tree-flip");
    };
    void Promise.allSettled(animations.map((animation) => animation.finished))
      .then(release);

    return () => { animations.forEach((animation) => animation.cancel()); release(); };
  }, [layoutKey, treeRef]);
  useLayoutEffect(() => {
    const tree = treeRef.current;
    const content = tree?.querySelector(".memo-tree-level");
    if (!tree || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const layout = new Map<string, DOMRect>();
      tree.querySelectorAll<HTMLElement>("[data-memo-tree-row-id]").forEach((row) => {
        const id = row.dataset["memoTreeRowId"];
        if (id && !row.closest("[inert]")) layout.set(id, row.getBoundingClientRect());
      });
      previousLayoutRef.current = layout;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [layoutKey, treeRef]);
  function captureFlipPositions() {
    if (treeRef.current === null) {
      return;
    }

    const snapshot = new Map<string, DOMRect>();
    treeRef.current
      .querySelectorAll<HTMLElement>("[data-memo-tree-row-id]")
      .forEach((row) => {
        const nodeId = row.dataset["memoTreeRowId"];

        if (nodeId !== undefined) {
          snapshot.set(nodeId, row.getBoundingClientRect());
        }
      });
    flipSnapshotRef.current = snapshot;
  }

  return captureFlipPositions;
}
