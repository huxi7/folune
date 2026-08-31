/**
 * [INPUT]: 依赖 Bun test、CanvasEntryBootstrap 短命缓存与最小 CanvasDetail fixture
 * [OUTPUT]: 锁定 bootstrap 的 canvas/user/token/TTL 隔离与一次消费，且命中时请求解析不得调用 getCanvas、同步渲染首帧必须直接采用目标 detail
 * [POS]: pages 的 Paper→Canvas 数据交接回归门禁；防止空舞台与重复初始 detail 请求重新出现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { CanvasDetail } from "../shared/api/canvas";
import {
  clearCanvasEntryBootstrapsForTest,
  consumeCanvasEntryBootstrap,
  peekCanvasEntryBootstrap,
  resolveCanvasRenderDetail,
  resolveInitialCanvasDetail,
  storeCanvasEntryBootstrap,
} from "./canvasEntryBootstrap";

const detail = (canvasId: string): CanvasDetail => ({
  canvas: {
    canvas_kind: "memo_default",
    created_at: "2026-08-30T00:00:00Z",
    metadata: {},
    node_id: canvasId,
    origin_node_id: "memo-1",
    origin_revision: 1,
    updated_at: "2026-08-30T00:00:00Z",
    user_id: "user-1",
    version: 1,
    viewport: {},
  },
  edges: [],
  node: {
    canvas: { kind: "memo_default", origin_node_id: "memo-1" },
    children: [],
    color: null,
    created_at: "2026-08-30T00:00:00Z",
    deleted_at: null,
    deleted_root_id: null,
    id: canvasId,
    icon: null,
    memo: null,
    metadata: {},
    node_type: "canvas",
    parent_id: null,
    revision: 1,
    sort_order: "1000",
    title: "画布",
    updated_at: "2026-08-30T00:00:00Z",
    user_id: "user-1",
  },
  nodes: [],
});

describe("Canvas entry bootstrap", () => {
  beforeEach(clearCanvasEntryBootstrapsForTest);

  test("只允许对应 canvas、user 和 token 消费一次", () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-1",
      detail: detail("canvas-1"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });

    expect(peekCanvasEntryBootstrap("canvas-1", "user-1")?.token).toBe(bootstrap.token);
    expect(peekCanvasEntryBootstrap("canvas-1", "user-2")).toBeNull();
    expect(consumeCanvasEntryBootstrap("canvas-2", bootstrap.token, "user-1")).toBeNull();
    expect(consumeCanvasEntryBootstrap("canvas-1", "wrong-token", "user-1")).toBeNull();
    expect(consumeCanvasEntryBootstrap("canvas-1", bootstrap.token, "user-1")?.detail)
      .toBe(bootstrap.detail);
    expect(consumeCanvasEntryBootstrap("canvas-1", bootstrap.token, "user-1"))
      .toBeNull();
  });

  test("过期 bootstrap 不可读取或消费", () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-1",
      detail: detail("canvas-1"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });
    bootstrap.expiresAt = 0;

    expect(peekCanvasEntryBootstrap("canvas-1", "user-1")).toBeNull();
    expect(consumeCanvasEntryBootstrap("canvas-1", bootstrap.token, "user-1"))
      .toBeNull();
  });

  test("命中 bootstrap 时不重复请求 getCanvas", async () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-1",
      detail: detail("canvas-1"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });
    let requests = 0;
    const result = await resolveInitialCanvasDetail(
      "canvas-1",
      "user-1",
      bootstrap,
      async () => {
        requests += 1;
        return detail("canvas-1");
      },
    );

    expect(result.usedBootstrap).toBe(true);
    expect(result.detail).toBe(bootstrap.detail);
    expect(requests).toBe(0);
  });

  test("路由首帧同步采用目标 bootstrap，旧 Canvas 会话不得穿透", () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-1",
      detail: detail("canvas-1"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });

    expect(resolveCanvasRenderDetail(
      "canvas-1",
      "user-1",
      "canvas-old",
      detail("canvas-old"),
      bootstrap,
    )).toBe(bootstrap.detail);
    expect(resolveCanvasRenderDetail(
      "canvas-1",
      "user-2",
      "canvas-old",
      detail("canvas-old"),
      bootstrap,
    )).toBeNull();
  });

  test("会话建立后只采用同 canvas 的实时文档", () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-1",
      detail: detail("canvas-1"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });
    const live = detail("canvas-1");

    expect(resolveCanvasRenderDetail(
      "canvas-1",
      "user-1",
      "canvas-1",
      live,
      bootstrap,
    )).toBe(live);
  });

  test("直接 URL 与错误 canvas 回退到真实请求", async () => {
    const bootstrap = storeCanvasEntryBootstrap({
      canvasId: "canvas-other",
      detail: detail("canvas-other"),
      sourceMemoId: "memo-1",
      userId: "user-1",
    });
    let requests = 0;
    const result = await resolveInitialCanvasDetail(
      "canvas-1",
      "user-1",
      bootstrap,
      async () => {
        requests += 1;
        return detail("canvas-1");
      },
    );

    expect(result.usedBootstrap).toBe(false);
    expect(result.detail.canvas.node_id).toBe("canvas-1");
    expect(requests).toBe(1);
  });
});
