/**
 * [INPUT]: 依赖 react 的 useCallback/useEffect/useMemo/useRef/useState、pages/explorePresentation 的 planExploreStage、widgets/cordGeometry 的 CordBox
 * [OUTPUT]: 对外提供 useExploreStage，把活纸的真实几何量成 ExploreStagePlan
 * [POS]: app/src/widgets 的探索态量尺；它是纯决策 explorePresentation 与真实 DOM 之间唯一的换算口。测量对象是活纸自己，而活纸在探索态里正被 transform 缩放，所以这里必须由已施加的变换反解出未变换布局盒——否则第二次测量会把上一次的缩放再缩一次，纸会越退越远
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  planExploreStage,
  type ExploreStageItem,
  type ExploreStagePlan,
} from "../pages/explorePresentation";
import type { CordBox } from "./cordGeometry";

type ExploreStageMetrics = {
  paper: CordBox;
  viewport: { height: number; width: number };
};

const sameMetrics = (
  left: ExploreStageMetrics | null,
  right: ExploreStageMetrics,
): boolean =>
  left !== null
  && Math.abs(left.paper.x - right.paper.x) < 0.5
  && Math.abs(left.paper.y - right.paper.y) < 0.5
  && left.paper.width === right.paper.width
  && left.paper.height === right.paper.height
  && left.viewport.width === right.viewport.width
  && left.viewport.height === right.viewport.height;

export function useExploreStage({
  items,
  mounted,
  paperRef,
}: {
  items: readonly ExploreStageItem[];
  mounted: boolean;
  paperRef: RefObject<HTMLElement | null>;
}): ExploreStagePlan | null {
  const [metrics, setMetrics] = useState<ExploreStageMetrics | null>(null);
  const appliedRef = useRef<ExploreStagePlan["paper"] | null>(null);

  const measure = useCallback(() => {
    const element = paperRef.current;
    if (element === null) {
      return;
    }

    // offsetWidth/offsetHeight 是布局值，不受 transform 影响；位置则要反解。
    // 正向: measuredLeft = layoutLeft + originX*(1 - scale) + translateX
    //       measuredTop  = layoutTop  + originY*(1 - scale)
    // 未施加变换时 scale=1、translateX=0，下式自然退化为直接取 rect。
    const applied = appliedRef.current;
    const scale = applied?.scale ?? 1;
    const rect = element.getBoundingClientRect();
    const next: ExploreStageMetrics = {
      paper: {
        height: element.offsetHeight,
        width: element.offsetWidth,
        x: rect.x - (applied?.originX ?? 0) * (1 - scale) - (applied?.translateX ?? 0),
        y: rect.y - (applied?.originY ?? 0) * (1 - scale),
      },
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
    setMetrics((current) => (sameMetrics(current, next) ? current : next));
  }, [paperRef]);

  useEffect(() => {
    if (!mounted) {
      appliedRef.current = null;
      setMetrics(null);
      return;
    }

    measure();
    let frame = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [measure, mounted]);

  const plan = useMemo(
    () => (metrics === null
      ? null
      : planExploreStage({
        items,
        paper: metrics.paper,
        viewport: metrics.viewport,
      })),
    [items, metrics],
  );

  // 记住已施加的变换供下一次测量反解；与 NotesWorkspace 的 onTitleChangeRef 同一范式
  appliedRef.current = plan?.paper ?? null;

  return plan;
}
