/**
 * [INPUT]: 依赖 Bun test 与 explorationStore 的探索相位机
 * [OUTPUT]: 覆盖过期响应作废、退场保留候选、重置清空候选与相位判定谓词
 * [POS]: shared/store 的探索瞬时状态回归测试；它同时是硬约束「候选只住 explorationStore」的门禁——这里断言候选的唯一生命周期，不启动 React、不发请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { beforeEach, describe, expect, test } from "bun:test";

import {
  isExplorationActive,
  isExplorationMounted,
  useExplorationStore,
  type ExplorationCandidate,
} from "./explorationStore";

const candidate = (nodeId: string, confidence: number): ExplorationCandidate => ({
  confidence,
  excerpt: "少则得，多则惑。",
  matched_channels: ["keyword"],
  node_id: nodeId,
  reason: "同一命题的另一种表述",
  revision: 3,
  title: "少则得",
});

const dropped = { excerpt_not_found: 1, judge_failed: 0, judged_irrelevant: 2 };

describe("explorationStore", () => {
  beforeEach(() => {
    useExplorationStore.getState().reset();
  });

  test("同一篇连按两次探索时，先到的旧响应不得覆盖新请求", () => {
    const store = useExplorationStore.getState();
    const stale = store.begin({ memoId: "memo-1", query: { kind: "memo", text: null } });
    const fresh = store.begin({ memoId: "memo-1", query: { kind: "memo", text: null } });
    expect(fresh).toBeGreaterThan(stale);

    useExplorationStore.getState().succeed(stale, {
      candidates: [candidate("old", 0.9)],
      dropped,
    });
    expect(useExplorationStore.getState()).toMatchObject({
      candidates: [],
      phase: "pending",
    });

    useExplorationStore.getState().succeed(fresh, {
      candidates: [candidate("new", 0.8)],
      dropped,
    });
    expect(useExplorationStore.getState().phase).toBe("ready");
    expect(useExplorationStore.getState().candidates[0]?.node_id).toBe("new");
  });

  test("零结果进入 empty 而不是 ready，丢弃计数仍然保留", () => {
    const requestId = useExplorationStore.getState().begin({
      memoId: "memo-1",
      query: { kind: "selection", text: "熵增" },
    });
    useExplorationStore.getState().succeed(requestId, { candidates: [], dropped });
    expect(useExplorationStore.getState()).toMatchObject({
      dropped,
      phase: "empty",
      query: { kind: "selection", text: "熵增" },
    });
  });

  test("退场期间候选必须留着——收拢动画要有东西可收，reset 之后才清空", () => {
    const requestId = useExplorationStore.getState().begin({
      memoId: "memo-1",
      query: { kind: "memo", text: null },
    });
    useExplorationStore.getState().succeed(requestId, {
      candidates: [candidate("a", 0.9)],
      dropped,
    });
    useExplorationStore.getState().leave();
    expect(useExplorationStore.getState().phase).toBe("leaving");
    expect(useExplorationStore.getState().candidates).toHaveLength(1);

    useExplorationStore.getState().reset();
    expect(useExplorationStore.getState()).toMatchObject({
      candidates: [],
      centerMemoId: null,
      dropped: null,
      phase: "idle",
    });
  });

  test("退场后到达的响应与失败都作废，不得把已经关掉的探索态拉回来", () => {
    const requestId = useExplorationStore.getState().begin({
      memoId: "memo-1",
      query: { kind: "memo", text: null },
    });
    useExplorationStore.getState().leave();
    useExplorationStore.getState().succeed(requestId, {
      candidates: [candidate("a", 0.9)],
      dropped,
    });
    expect(useExplorationStore.getState().phase).toBe("leaving");
    useExplorationStore.getState().fail(requestId);
    expect(useExplorationStore.getState().phase).toBe("leaving");
  });

  test("相位谓词: leaving 仍挂载但已不活跃，idle 两者皆否", () => {
    expect(isExplorationMounted("leaving")).toBe(true);
    expect(isExplorationActive("leaving")).toBe(false);
    expect(isExplorationMounted("idle")).toBe(false);
    expect(isExplorationActive("ready")).toBe(true);
    expect(isExplorationActive("pending")).toBe(true);
  });
});
