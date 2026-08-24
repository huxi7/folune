/**
 * [INPUT]: 依赖 react 的 Ref/ReactNode/CSSProperties、pages/explorePresentation 的 ExploreStagePlan 与 styles/explore-stage.css 的 .paper-retreat
 * [OUTPUT]: 对外提供 PaperRetreat，把量好的退后变换交给活纸外层
 * [POS]: app/src/widgets 的活纸退后包裹；它是探索态里唯一被 transform 缩放的元素，也是量纸几何的那把尺，因此变换变量名只在此处出现一次——生产壳层与 DEV 实验台共用它，二者的几何才不可能分叉
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CSSProperties, ReactNode, Ref } from "react";

import type { ExploreStagePlan } from "../pages/explorePresentation";

type PaperRetreatProps = {
  children: ReactNode;
  /** 探索态是否挂载；比 retreated 早一帧置位，让 will-change 先就位再开始位移 */
  exploring: boolean;
  plan: ExploreStagePlan | null;
  ref?: Ref<HTMLDivElement>;
  retreated: boolean;
};

export function PaperRetreat({
  children,
  exploring,
  plan,
  ref,
  retreated,
}: PaperRetreatProps) {
  return (
    <div
      className="paper-retreat"
      data-exploring={exploring}
      data-retreated={retreated}
      ref={ref}
      style={plan === null ? undefined : {
        "--explore-paper-origin-x": `${plan.paper.originX}px`,
        "--explore-paper-origin-y": `${plan.paper.originY}px`,
        "--explore-paper-scale": String(plan.paper.scale),
        "--explore-paper-translate-x": `${plan.paper.translateX}px`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
