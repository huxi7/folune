/**
 * [INPUT]: 依赖 tree 容器、结构身份、共享 FLIP 时间轴和归档运动租约
 * [OUTPUT]: 对外提供 useTreeReorder 与手势前捕获入口；旧行连续让位、新行独立淡入且连点不重置时钟，布局批量读取后接续位移，滚动和临时 ID 对账不重播
 * [POS]: AppSidebar 的结构动效层；以稳定 DOM 实例和容器内容坐标保存布局，展开高度归 TreeDisclosure，连续结构变更从在途位置接续
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { treeFlipDurationMs, treeFlipEase, treeFlipEasing } from "../pages/workspaceMotion";
import { beginArchiveMotion, endArchiveMotion } from "./archiveCordMotion";

type Position = { x: number; y: number };
type Layout = Map<HTMLElement, Position>;
type RowMotion = Position & { animation: Animation };

// ---- 快照只认内容坐标：滚动与整个 Panel 的位移不是树结构变化 ----
function readLayout(tree: HTMLDivElement): Layout {
  const bounds = tree.getBoundingClientRect();
  const layout: Layout = new Map();
  tree.querySelectorAll<HTMLElement>("[data-memo-tree-row-id]").forEach((row) => {
    if (row.closest('[inert], [aria-hidden="true"]')) return;
    const rect = row.getBoundingClientRect();
    layout.set(row, {
      x: rect.left - bounds.left + tree.scrollLeft,
      y: rect.top - bounds.top + tree.scrollTop,
    });
  });
  return layout;
}

function remainingMotion(motion: RowMotion): number {
  const elapsed = typeof motion.animation.currentTime === "number"
    ? motion.animation.currentTime
    : 0;
  return 1 - treeFlipEase(elapsed / treeFlipDurationMs);
}

export function useTreeReorder(treeRef: RefObject<HTMLDivElement | null>, layoutKey: string) {
  const capturedLayoutRef = useRef<Layout | null>(null);
  const previousLayoutRef = useRef<Layout | null>(null);
  const motionsRef = useRef(new Map<HTMLElement, RowMotion>());
  const entriesRef = useRef(new Map<HTMLElement, Animation>());
  const releaseRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const tree = treeRef.current;
    if (tree === null) return;

    const captured = capturedLayoutRef.current;
    const previous = captured ?? previousLayoutRef.current;
    const snapshot = previous === null ? null : new Map(previous);
    // 保留动画时批量读取，再扣除已知位移；避免 cancel 写样式后再强制读布局。
    const current = readLayout(tree);
    capturedLayoutRef.current = null;

    // 先保存正在显示的位置再取消；effect cleanup 提前 cancel 会先跳到终点再倒退。
    motionsRef.current.forEach((motion, row) => {
      const remaining = remainingMotion(motion);
      const position = snapshot?.get(row);
      if (position && captured === null) {
        snapshot?.set(row, {
          x: position.x + motion.x * remaining,
          y: position.y + motion.y * remaining,
        });
      }
      const target = current.get(row);
      if (target) current.set(row, { x: target.x - motion.x * remaining, y: target.y - motion.y * remaining });
    });
    motionsRef.current.forEach(({ animation }) => animation.cancel());
    motionsRef.current.clear();
    releaseRef.current?.();
    releaseRef.current = null;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    entriesRef.current.forEach((animation, row) => {
      if (reduced || !current.has(row)) { animation.cancel(); entriesRef.current.delete(row); }
    });
    previousLayoutRef.current = current;
    if (snapshot === null || reduced) return;

    current.forEach((position, row) => {
      const origin = snapshot.get(row);
      const x = origin === undefined ? 0 : origin.x - position.x;
      const y = origin === undefined ? 0 : origin.y - position.y;
      // 淡入属于行的出生生命周期；后续插入只重定向位置，不延长显现时间。
      if (origin === undefined && !entriesRef.current.has(row)) {
        const entry = row.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: treeFlipDurationMs, easing: treeFlipEasing,
        });
        entriesRef.current.set(row, entry);
        void entry.finished.catch(() => {}).then(() => {
          if (entriesRef.current.get(row) === entry) entriesRef.current.delete(row);
        });
      }
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;

      const animation = row.animate([
        { transform: `translate(${x}px, ${y}px)` },
        { transform: "translate(0, 0)" },
      ], { duration: treeFlipDurationMs, easing: treeFlipEasing });
      motionsRef.current.set(row, { animation, x, y });
    });

    const batch = [...motionsRef.current.entries()];
    if (batch.length === 0) return;
    beginArchiveMotion("tree-flip");
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      endArchiveMotion("tree-flip");
    };
    releaseRef.current = release;
    void Promise.allSettled(batch.map(([, { animation }]) => animation.finished)).then(() => {
      // 新的一次插入可能已接管同一行，旧 Promise 不得清掉新动画。
      batch.forEach(([row, { animation }]) => {
        if (motionsRef.current.get(row)?.animation === animation) motionsRef.current.delete(row);
      });
      release();
    });
  }, [layoutKey, treeRef]);

  useLayoutEffect(() => {
    const tree = treeRef.current;
    const content = tree?.querySelector(".memo-tree-level");
    if (!tree || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // FLIP 期间的 rect 含 transform，不能把中途位置覆盖为下一次的终态基线。
      if (motionsRef.current.size === 0) previousLayoutRef.current = readLayout(tree);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [layoutKey, treeRef]);

  useLayoutEffect(() => () => {
    motionsRef.current.forEach(({ animation }) => animation.cancel());
    motionsRef.current.clear();
    entriesRef.current.forEach((animation) => animation.cancel());
    entriesRef.current.clear();
    releaseRef.current?.();
    capturedLayoutRef.current = null;
    previousLayoutRef.current = null;
  }, []);

  return function captureFlipPositions() {
    if (treeRef.current !== null) capturedLayoutRef.current = readLayout(treeRef.current);
  };
}
