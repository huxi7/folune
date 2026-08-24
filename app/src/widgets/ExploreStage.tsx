/**
 * [INPUT]: 依赖 react 的 useEffect/useId/useRef/useState、widgets/Cord 的 CordLayer/Cord、widgets/ExploreResultPanel、shared/design-system 的 Skeleton、pages/explorePresentation 的 ExploreStagePlan 与两个错峰延迟、shared/store/explorationStore 的候选与相位类型、styles/explore-stage.css
 * [OUTPUT]: 对外提供 WorkspaceExploration 视图契约，以及卡片/连线同步拖动并把临时排布交给保存命令的 ExploreStage 探索浮层
 * [POS]: app/src/widgets 的探索态视图；plan 仍是 AI 亲疏关系的初始几何真相，组件只持有本轮用户拖动的瞬时偏移，退出即弃、保存时才落库。槽位按下标而非 node_id 作 key——骨架与实卡必须是同一个 DOM 节点，「逐张变实」才是同一张卡被读懂，而不是一张消失另一张出现。stars 为假时（reduced-motion 或窗口排不开）改用静态清单，那是 ExploreResultPanel 唯一的用途
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { ExploreStageItem, ExploreStagePlan } from "../pages/explorePresentation";
import {
  exploreGlideDelayMs,
  exploreMaterializeDelayMs,
} from "../pages/explorePresentation";
import { Skeleton, SkeletonGroup } from "../shared/design-system/components";
import type {
  ExplorationCandidate,
  ExplorationDropped,
  ExplorationPhase,
} from "../shared/store/explorationStore";
import { Cord, CordLayer } from "./Cord";
import { ExploreResultPanel } from "./ExploreResultPanel";

/** 壳层与舞台共同消费的探索态视图契约；由 pages/useMemoExplore 提供 */
export type WorkspaceExploration = {
  /** 已进入的稳定态；leaving 期间为 false，驱动收拢 */
  active: boolean;
  candidates: ExplorationCandidate[];
  dismiss: () => void;
  drill: (nodeId: string) => void;
  dropped: ExplorationDropped | null;
  exploring: boolean;
  items: ExploreStageItem[];
  mounted: boolean;
  phase: ExplorationPhase;
  /** 把这一次探索连同排布一起保存成画布；虚线到此变实线 */
  save: (offsets: readonly { id: string; x: number; y: number }[]) => Promise<void>;
  savedCanvasId: string | null;
};

type ExploreStageProps = {
  exploration: WorkspaceExploration;
  plan: ExploreStagePlan | null;
  /** 是否呈现径向候选；否则退回静态清单 */
  stars: boolean;
};

type SlotStyle = CSSProperties & {
  "--explore-glide-delay": string;
  "--explore-materialize-delay": string;
  "--explore-x": string;
  "--explore-y": string;
};

type DragOffset = { x: number; y: number };

type ActiveDrag = {
  id: string;
  origin: DragOffset;
  pointerId: number;
  startX: number;
  startY: number;
};

const DRAG_THRESHOLD = 4;
const STAGE_EDGE_GAP = 24;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const captionOf = (
  phase: ExplorationPhase,
  dropped: ExplorationDropped | null,
): string => {
  if (phase === "pending") {
    return "正在读你的笔记…";
  }
  if (phase === "error") {
    return "这次没能读完，Esc 回到纸上";
  }
  if (phase === "empty") {
    const read = dropped === null
      ? 0
      : dropped.judged_irrelevant + dropped.excerpt_not_found + dropped.judge_failed;
    return read === 0
      ? "没有找到明确相关的笔记，Esc 回到纸上"
      : `读过 ${read} 篇，都不够像。Esc 回到纸上`;
  }
  return "点一张卡片，从它再展开一层 · Esc 回到纸上";
};

export function ExploreStage({ exploration, plan, stars }: ExploreStageProps) {
  const baseId = useId().replace(/[^a-zA-Z0-9_-]/gu, "");
  const { candidates, dropped, exploring, phase, savedCanvasId } = exploration;
  const saved = savedCanvasId !== null;
  const [dragOffsets, setDragOffsets] = useState<Record<string, DragOffset>>({});
  const dragRef = useRef<ActiveDrag | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const candidateKey = candidates.map((candidate) => candidate.node_id).join("|");

  useEffect(() => {
    dragRef.current = null;
    suppressClickRef.current = null;
    setDragOffsets({});
  }, [candidateKey, phase === "pending"]);

  if (!stars) {
    return (
      <div className="explore-static">
        <ExploreResultPanel
          exploring={exploring}
          onClose={exploration.dismiss}
          onSelectMemo={exploration.drill}
          result={candidates.length === 0 || dropped === null
            ? null
            : { dropped, related: candidates }}
        />
      </div>
    );
  }

  const byNodeId = new Map(
    candidates.map((candidate) => [candidate.node_id, candidate]),
  );
  const slots = plan?.slots ?? [];
  const displayedSlots = slots.map((slot) => {
    const offset = dragOffsets[slot.id] ?? { x: 0, y: 0 };
    return {
      ...slot,
      cordTo: {
        ...slot.cordTo,
        x: slot.cordTo.x + offset.x,
        y: slot.cordTo.y + offset.y,
      },
      x: slot.x + offset.x,
      y: slot.y + offset.y,
    };
  });

  const moveSlot = (id: string, nextOffset: DragOffset) => {
    if (plan === null) return;
    const slot = slots.find((item) => item.id === id);
    if (slot === undefined) return;

    const minX = STAGE_EDGE_GAP + plan.card.width / 2;
    const maxX = window.innerWidth - minX;
    const minY = STAGE_EDGE_GAP + plan.card.height / 2;
    const maxY = window.innerHeight
      - STAGE_EDGE_GAP
      - plan.card.height / 2
      - plan.reason.gap
      - plan.reason.height;
    const nextX = clamp(slot.x + nextOffset.x, minX, Math.max(minX, maxX));
    const nextY = clamp(slot.y + nextOffset.y, minY, Math.max(minY, maxY));

    setDragOffsets((current) => ({
      ...current,
      [id]: { x: nextX - slot.x, y: nextY - slot.y },
    }));
  };

  const beginDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (event.button !== 0 || saved || phase !== "ready") return;
    const origin = dragOffsets[id] ?? { x: 0, y: 0 };
    dragRef.current = {
      id,
      origin,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    moveSlot(drag.id, {
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const moved = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    ) >= DRAG_THRESHOLD;
    if (moved) suppressClickRef.current = drag.id;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      aria-label="探索到的关联笔记"
      className="explore-stage"
      data-active={exploration.active}
      data-phase={phase}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          exploration.dismiss();
        }
      }}
      role="region"
      style={plan === null ? undefined : {
        "--explore-card-height": `${plan.card.height}px`,
        "--explore-card-width": `${plan.card.width}px`,
        "--explore-reason-gap": `${plan.reason.gap}px`,
      } as CSSProperties}
    >
      <div aria-hidden="true" className="explore-stage-grid" />

      <CordLayer className="explore-stage-cords">
        {displayedSlots.map((slot, index) => (
          <Cord
            draw
            flow={exploring}
            from={slot.cordFrom}
            key={index}
            mode="radial"
            to={slot.cordTo}
            tone={saved ? "relation" : "explore"}
            variant={saved ? "solid" : "dashed"}
          />
        ))}
      </CordLayer>

      {displayedSlots.map((slot, index) => {
        const candidate = byNodeId.get(slot.id) ?? null;
        const reasonId = `${baseId}-reason-${index}`;
        const slotStyle: SlotStyle = {
          "--explore-glide-delay": `${exploreGlideDelayMs(slot.order)}ms`,
          "--explore-materialize-delay": `${exploreMaterializeDelayMs(slot.order)}ms`,
          "--explore-x": `${slot.x}px`,
          "--explore-y": `${slot.y}px`,
        };

        return (
          <div className="explore-slot" key={index} style={slotStyle}>
            {candidate === null ? (
              <SkeletonGroup
                className="explore-card explore-card-pending"
                label="正在寻找关联笔记"
                visible={exploring}
              >
                <Skeleton className="explore-card-skeleton-title" shape="text" />
                <Skeleton className="explore-card-skeleton-line" shape="text" />
                <Skeleton
                  className="explore-card-skeleton-line explore-card-skeleton-line-short"
                  shape="text"
                />
              </SkeletonGroup>
            ) : (
              <>
                <button
                  aria-describedby={reasonId}
                  aria-roledescription="可拖动的关联笔记"
                  className="explore-card"
                  data-side={slot.side}
                  onClick={() => {
                    if (suppressClickRef.current === candidate.node_id) {
                      suppressClickRef.current = null;
                      return;
                    }
                    exploration.drill(candidate.node_id);
                  }}
                  onKeyDown={(event) => {
                    const direction = {
                      ArrowDown: { x: 0, y: 12 },
                      ArrowLeft: { x: -12, y: 0 },
                      ArrowRight: { x: 12, y: 0 },
                      ArrowUp: { x: 0, y: -12 },
                    }[event.key];
                    if (direction === undefined || saved) return;
                    event.preventDefault();
                    const current = dragOffsets[candidate.node_id] ?? { x: 0, y: 0 };
                    moveSlot(candidate.node_id, {
                      x: current.x + direction.x,
                      y: current.y + direction.y,
                    });
                  }}
                  onPointerCancel={finishDrag}
                  onPointerDown={(event) => beginDrag(event, candidate.node_id)}
                  onPointerMove={continueDrag}
                  onPointerUp={finishDrag}
                  type="button"
                >
                  <span className="explore-card-title">{candidate.title}</span>
                  <span className="explore-card-excerpt">{candidate.excerpt}</span>
                </button>
                {/* 理由紧贴卡片之外、永远整段可见: 用户按下 ⌘E 想知道的从来不是「有哪些」，是「凭什么」 */}
                <p className="explore-reason" id={reasonId}>{candidate.reason}</p>
              </>
            )}
          </div>
        );
      })}

      <footer className="explore-stage-footer">
        <p className="explore-stage-caption" role="status">
          {saved ? "已写入关联 · 画布在文件库里" : captionOf(phase, dropped)}
        </p>
        {phase === "ready" && !saved && plan !== null ? (
          <button
            className="explore-stage-save"
            onClick={() => void exploration.save(displayedSlots.map((slot) => ({
              id: slot.id,
              x: Math.round(slot.x - plan.hub.x),
              y: Math.round(slot.y - plan.hub.y),
            })))}
            type="button"
          >
            保存为画布
          </button>
        ) : null}
      </footer>
    </div>
  );
}
