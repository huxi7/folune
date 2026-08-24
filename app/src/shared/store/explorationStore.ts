/**
 * [INPUT]: 依赖 zustand 的 create
 * [OUTPUT]: 对外提供 ExplorationCandidate/ExplorationDropped/ExplorationQuery/ExplorationPhase 类型、已保存画布 id 与 useExplorationStore
 * [POS]: shared/store 的探索候选唯一住所；它存在的理由就是让「候选与摘录绝不进 memoTreeStore」这条约束有物理落点——探索是瞬时只读判断，退出即弃、零数据库写入，因此这里不持久化、不合并进目录树、也不参与任何 Command 台账
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

/** 一条已通过后端引文复核的关联笔记；excerpt 逐字来自 revision 对应的真实正文 */
export type ExplorationCandidate = {
  confidence: number;
  excerpt: string;
  matched_channels: string[];
  node_id: string;
  reason: string;
  revision: number;
  title: string;
};

/** 丢弃分布只服务可观测性，不含任何正文 */
export type ExplorationDropped = {
  excerpt_not_found: number;
  judge_failed: number;
  judged_irrelevant: number;
};

/** 选中文字与整篇是同一次探索的两种取值，未选中即整篇 */
export type ExplorationQuery = {
  kind: "memo" | "selection";
  text: string | null;
};

/**
 * leaving 是退场专用相位: 候选必须活到收拢动画结束，否则卡片会在原地消失而不是退回去。
 * idle 之外的一切相位都意味着探索态正在占据屏幕。
 */
export type ExplorationPhase =
  | "empty"
  | "error"
  | "idle"
  | "leaving"
  | "pending"
  | "ready";

export type ExplorationState = {
  candidates: ExplorationCandidate[];
  centerMemoId: string | null;
  dropped: ExplorationDropped | null;
  phase: ExplorationPhase;
  query: ExplorationQuery | null;
  /** 已保存成画布的那一张的 node_id；非空即表示这些关联已写入关系表，连线因此转为实线 */
  savedCanvasId: string | null;
  /** 单调递增的请求序号；过期响应据此丢弃，避免快速连按 ⌘E 时旧结果覆盖新结果 */
  requestId: number;
};

type ExplorationStore = ExplorationState & {
  begin(input: { memoId: string; query: ExplorationQuery }): number;
  fail(requestId: number): void;
  leave(): void;
  markSaved(canvasNodeId: string): void;
  reset(): void;
  succeed(
    requestId: number,
    result: {
      candidates: ExplorationCandidate[];
      dropped: ExplorationDropped;
    },
  ): void;
};

const IDLE: ExplorationState = {
  candidates: [],
  centerMemoId: null,
  dropped: null,
  phase: "idle",
  query: null,
  requestId: 0,
  savedCanvasId: null,
};

/** 相位是否还在等这一次请求的结果；leaving/idle 期间到达的响应一律作废 */
const awaits = (state: ExplorationState, requestId: number): boolean =>
  state.phase === "pending" && state.requestId === requestId;

export const useExplorationStore = create<ExplorationStore>((set, get) => ({
  ...IDLE,
  begin: ({ memoId, query }) => {
    const requestId = get().requestId + 1;
    set({
      candidates: [],
      centerMemoId: memoId,
      dropped: null,
      phase: "pending",
      query,
      requestId,
      savedCanvasId: null,
    });
    return requestId;
  },
  fail: (requestId) => {
    if (!awaits(get(), requestId)) {
      return;
    }
    set({ candidates: [], dropped: null, phase: "error" });
  },
  markSaved: (canvasNodeId) => set({ savedCanvasId: canvasNodeId }),
  leave: () => {
    if (get().phase === "idle") {
      return;
    }
    set({ phase: "leaving" });
  },
  reset: () => set({ ...IDLE, requestId: get().requestId }),
  succeed: (requestId, result) => {
    if (!awaits(get(), requestId)) {
      return;
    }
    set({
      candidates: result.candidates,
      dropped: result.dropped,
      phase: result.candidates.length === 0 ? "empty" : "ready",
    });
  },
}));

/** 探索态是否正在占据屏幕（含退场动画期间） */
export const isExplorationMounted = (phase: ExplorationPhase): boolean =>
  phase !== "idle";

/** 是否处于「已进入」的稳定态；leaving 期间为 false，驱动收拢动画 */
export const isExplorationActive = (phase: ExplorationPhase): boolean =>
  phase !== "idle" && phase !== "leaving";
