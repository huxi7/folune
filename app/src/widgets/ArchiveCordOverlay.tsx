/**
 * [INPUT]: 依赖 WorkspaceOrganizePresentation 与可见性策略、archiveCordGeometry 的连续钳制与端点插值、archiveCordMotion 租约、共享 tree FLIP 时间轴；可选 scopeSelector 用于隔离嵌入式样板
 * [OUTPUT]: 对外提供 fixed viewport ArchiveCordOverlay；单一调度器直接写 visible/flow/hit 三条 path 的 d，命中区把点击委托给与 source 相同的定位命令
 * [POS]: Paper 与真实文件树之间的归档事实渲染层；source 来自 ArchiveStatus，target 只来自树上唯一的 data-archive-representative，presentation 生命周期归 Dashboard，代表解析归 AppSidebar，这里不猜树也不写 React 几何状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";

import { treeFlipDurationMs, treeFlipEase } from "../pages/workspaceMotion";
import {
  archiveCordCurve,
  archiveCordGeometry,
  lerpArchiveAnchor,
} from "./archiveCordGeometry";
import { isArchiveMotionActive, subscribeArchiveMotion } from "./archiveCordMotion";
import {
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";
import type { CordPoint } from "./cordGeometry";

type ArchiveCordOverlayProps = {
  libraryOpen: boolean;
  /** 点击命中区与点击 source 是同一个意图：打开文件库、展开到目标、聚焦它 */
  onLocate?: () => void;
  overlayPanels: boolean;
  presentation: WorkspaceOrganizePresentation | null;
  /** 开发态嵌入样板的局部查询根；生产调用省略并使用全局工作区 */
  scopeSelector?: string;
};

const SOURCE_SELECTOR = '[data-archive-source="true"]';
const REPRESENTATIVE_SELECTOR = "[data-archive-representative]";
const TREE_SELECTOR = ".app-sidebar-tree";

const rectOf = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  };
};

export function ArchiveCordOverlay({
  libraryOpen,
  onLocate,
  overlayPanels,
  presentation,
  scopeSelector,
}: ArchiveCordOverlayProps) {
  const overlayRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const flowRef = useRef<SVGPathElement>(null);
  const hitRef = useRef<SVGPathElement>(null);
  const visible = shouldShowArchiveCord({ libraryOpen, overlayPanels, presentation });

  /*
   * phase 是这根线唯一的 React state, 而且是「正在播放那一次自绘吗」这个低频语义,
   * 不是几何。它只由新的语义结果推动: 滚动、resize、折叠、展开、文件库重开与刷新
   * 恢复都不改它, 因此 restored 进来的 presentation 直接落在 settled。
   *
   * 自绘播完就回到 settled —— 于是 data-phase 始终是当前状态的诚实读数, 而不是一个
   * 播过一次就永久留在 DOM 上的触发痕迹; 同时 settled → fresh 这个切换本身就会让 CSS
   * 重新起一次动画, 所以第二次真实整理不需要 remount 任何节点(remount 会让 d 空一帧)。
   * 播过的 run 记在 ref 里, 所以同一次结果再进来多少遍都不会重播。
   */
  const [phase, setPhase] = useState<"fresh" | "settled">("settled");
  const playedTokenRef = useRef<string | null>(null);
  const origin = presentation?.origin ?? null;
  const runId = presentation?.runId ?? null;
  const status = presentation?.status ?? null;

  useEffect(() => {
    if (runId === null) {
      playedTokenRef.current = null;
      setPhase("settled");
      return;
    }
    if (origin !== "fresh") return;
    const token = `${runId}:${status}`;
    if (playedTokenRef.current === token) return;
    playedTokenRef.current = token;
    /*
     * Reduced Motion 下没有「刚刚发生」可播, 直接停在正确终态: 进了 fresh 却没有动画,
     * animationend 永不到达, phase 就会永久卡在一个不成立的读数上。
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPhase("fresh");
  }, [origin, runId, status]);

  useEffect(() => {
    if (!visible) return;

    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame: number | null = null;
    /*
     * 代表迁移的插值状态。它只活在这个闭包里 —— geometry 进 React state 就等于让
     * 每一帧滚动都走一次 commit, 那正是「线永远追在滚动后面跑」的成因。
     */
    let drawnRepresentativeId: string | null = null;
    let drawnTargetAnchor: CordPoint | null = null;
    let transitionFrom: CordPoint | null = null;
    let transitionStartedAt = 0;

    /** 返回 true 表示端点迁移仍在进行，需要下一帧继续 */
    const draw = (): boolean => {
      const scope = scopeSelector === undefined
        ? document
        : document.querySelector<HTMLElement>(scopeSelector);
      const source = scope?.querySelector<HTMLElement>(SOURCE_SELECTOR) ?? null;
      const row = scope?.querySelector<HTMLElement>(REPRESENTATIVE_SELECTOR) ?? null;
      const overlay = overlayRef.current;
      const path = pathRef.current;
      const flow = flowRef.current;
      const hit = hitRef.current;
      if (overlay === null || path === null || flow === null || hit === null) {
        return false;
      }

      // 嵌入式样板离开视口时保留 presentation，但不把旧几何留在别的卡片上。
      if (scopeSelector !== undefined && scope !== document) {
        // scope 的联合类型里还有 document, 只有 instanceof 能把它分出去
        const scopeRect = scope instanceof Element
          ? scope.getBoundingClientRect()
          : undefined;
        if (
          scopeRect === undefined
          || scopeRect.width === 0
          || scopeRect.height === 0
          || scopeRect.bottom <= 0
          || scopeRect.top >= window.innerHeight
        ) {
          overlay.setAttribute("data-target", "holding");
          return false;
        }
      }

      /*
       * 代表 DOM 暂时不在（刚展开、行还没挂上；或树还没 ready）: 保留上一帧的几何，
       * 等下一次 tree mutation。清空成空路径会让线在展开的那一帧闪一下不见,
       * 而连到别的行则是撒谎。
       */
      if (source === null || row === null) {
        overlay.setAttribute("data-target", "holding");
        return false;
      }

      // 读全部布局，再统一写属性：中间不夹任何写操作，避免强制回流交错
      const tree = scope?.querySelector<HTMLElement>(TREE_SELECTOR) ?? null;
      const geometry = archiveCordGeometry({
        sourceRect: rectOf(source),
        targetRect: rectOf(row),
        treeRect: tree === null ? null : rectOf(tree),
      });
      if (geometry === null) {
        overlay.setAttribute("data-target", "holding");
        return false;
      }

      const representativeId = row.dataset["memoTreeRowId"] ?? null;
      if (
        !reduceMotion
        && drawnRepresentativeId !== null
        && drawnTargetAnchor !== null
        && representativeId !== drawnRepresentativeId
      ) {
        // 从当前绘制位置续算：迁移途中再次折叠不会把线头弹回旧起点
        transitionFrom = drawnTargetAnchor;
        transitionStartedAt = performance.now();
      }
      drawnRepresentativeId = representativeId;

      let targetAnchor = geometry.targetAnchor;
      let transitioning = false;
      if (transitionFrom !== null) {
        const progress = (performance.now() - transitionStartedAt) / treeFlipDurationMs;
        if (progress >= 1) {
          transitionFrom = null;
        } else {
          // 与树行 FLIP 同一条曲线；线头晚到或早到一帧都会被读成两个物体
          targetAnchor = lerpArchiveAnchor(
            transitionFrom,
            geometry.targetAnchor,
            treeFlipEase(progress),
          );
          transitioning = true;
        }
      }

      const curve = transitioning
        ? archiveCordCurve({ ...geometry, targetAnchor })
        : geometry.curve;
      drawnTargetAnchor = targetAnchor;

      path.setAttribute("d", curve.d);
      flow.setAttribute("d", curve.d);
      hit.setAttribute("d", curve.d);
      overlay.setAttribute("data-target", "anchored");
      overlay.setAttribute("data-projection", geometry.projection);
      return transitioning;
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        // 有任何一段运动租约在手就继续逐帧；全部归还且几何静止就停下，不空转
        if (draw() || isArchiveMotionActive()) schedule();
      });
    };

    draw();

    const scope = scopeSelector === undefined
      ? document
      : document.querySelector<HTMLElement>(scopeSelector);
    const tree = scope?.querySelector(TREE_SELECTOR) ?? null;
    const mutationObserver = new MutationObserver(schedule);
    if (tree !== null) {
      mutationObserver.observe(tree, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    const resizeObserver = new ResizeObserver(schedule);
    [
      tree,
      document.querySelector(".paper-stage-scroll"),
      scope?.querySelector(SOURCE_SELECTOR) ?? null,
    ]
      .filter((element): element is Element => element !== null)
      .forEach((element) => resizeObserver.observe(element));
    /*
     * Panel 用 Motion 的 x/opacity Tween 移动，树行用 WAAPI FLIP —— 两者都是纯
     * transform, ResizeObserver 看不见、transitionend 也不会来。所以运动期间靠租约
     * 逐帧重算, 而不是靠猜结尾。
     */
    const unsubscribeMotion = subscribeArchiveMotion(schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      unsubscribeMotion();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [scopeSelector, visible]);

  return (
    <svg
      aria-hidden="true"
      className="archive-cord-overlay"
      data-phase={phase}
      data-visible={visible}
      ref={overlayRef}
    >
      <g className="archive-cord-overlay-strands">
        <path
          className="archive-cord-overlay-path"
          pathLength={1}
          ref={pathRef}
        />
        {/* 流光是两条里更长的那一条：它结束才算这次 fresh 真的播完 */}
        <path
          className="archive-cord-overlay-flow"
          onAnimationEnd={() => setPhase("settled")}
          pathLength={1}
          ref={flowRef}
        />
      </g>
      <path
        className="archive-cord-overlay-hit"
        onClick={onLocate}
        ref={hitRef}
      />
    </svg>
  );
}
