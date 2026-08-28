/**
 * [INPUT]: 依赖 Bun test、内存 WAL、ApiError、CanvasSaveCoordinator 与 canvasDocument 投影
 * [OUTPUT]: 覆盖空恢复归闲、WAL 先于 UI、人工/AI 顺序、稳定 ID 重试、单次 409 rebase、串行回执清理和 48KiB pagehide 有界发送
 * [POS]: shared/store 的 Canvas persistenceSlice/协调器回归门禁；断网与响应丢失不能复制或丢弃用户意图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type {
  CanvasDetail,
  CanvasMutationRequest,
  CanvasMutationResult,
} from "../api/canvas";
import { ApiError } from "../api/client";
import {
  CanvasSaveCoordinator,
  CANVAS_KEEPALIVE_MAX_BYTES,
  canvasMutationByteLength,
  type CanvasCoordinatorSink,
} from "./CanvasSaveCoordinator";
import {
  applyCanvasIntents,
  applyCanvasMutationResult,
  type CanvasIntent,
} from "./canvasDocument";
import { createMemoryCanvasWalStorage } from "./canvasWal";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CANVAS_ID = "22222222-2222-4222-8222-222222222222";
const ROOT_ID = "33333333-3333-4333-8333-333333333333";
const MEMO_ID = "44444444-4444-4444-8444-444444444444";

const detail = (version = 1): CanvasDetail => ({
  canvas: {
    canvas_kind: "memo_default",
    created_at: "",
    metadata: {},
    node_id: CANVAS_ID,
    origin_node_id: MEMO_ID,
    origin_revision: 1,
    updated_at: "",
    user_id: USER_ID,
    version,
    viewport: {},
  },
  edges: [],
  node: {} as CanvasDetail["node"],
  nodes: [{
    created_by: "user",
    discovered_from_id: null,
    height: null,
    id: ROOT_ID,
    kind: "memo_ref",
    snapshot_excerpt: "根",
    snapshot_revision: 1,
    snapshot_title: "根",
    target: null,
    target_node_id: MEMO_ID,
    text: null,
    text_scale: null,
    width: null,
    x: 0,
    y: 0,
  }],
});

const resultFor = (
  request: CanvasMutationRequest,
  version = request.base_version + 1,
): CanvasMutationResult => ({
  aliases: [],
  dropped: [],
  expansion_status: null,
  intent_digest: "a".repeat(64),
  mutation_id: request.mutation_id,
  noops: [],
  removed_edge_ids: [],
  removed_node_ids: [],
  upserted_edges: [],
  upserted_nodes: [],
  version,
});

const createSink = (initial: CanvasDetail) => {
  let server = initial;
  let view = initial;
  const statuses: string[] = [];
  const sink: CanvasCoordinatorSink = {
    applyLocal(intent) {
      view = applyCanvasIntents(view, [intent]);
    },
    confirm(intents, result, pending) {
      server = applyCanvasMutationResult(server, intents, result);
      view = applyCanvasIntents(server, pending);
    },
    getServerVersion() {
      return server.canvas.version;
    },
    replaceServer(next, pending) {
      server = next;
      view = applyCanvasIntents(next, pending);
    },
    setPersistence(status) {
      statuses.push(status);
    },
  };
  return {
    get server() { return server; },
    get view() { return view; },
    sink,
    statuses,
  };
};

describe("CanvasSaveCoordinator", () => {
  test("空 WAL 恢复完成后明确回到已同步状态", async () => {
    const sinkState = createSink(detail());
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: createMemoryCanvasWalStorage(),
      transport: {
        async commitExpansion(request) { return resultFor(request); },
        async getCanvas() { return detail(); },
        keepalive() { return false; },
        async mutate(request) { return resultFor(request); },
      },
    });

    await coordinator.recover(detail());

    expect(sinkState.statuses).toEqual(["recovering", "recovering", "idle"]);
  });

  test("WAL 写失败时不把操作伪装成安全的本地成功", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: {
        ...memory,
        async put() {
          throw new Error("quota full");
        },
      },
      transport: {
        async commitExpansion(request) { return resultFor(request); },
        async getCanvas() { return detail(); },
        keepalive() { return false; },
        async mutate(request) { return resultFor(request); },
      },
    });
    await coordinator.recover(detail());

    await expect(coordinator.enqueue({
      operation: {
        node_id: "55555555-5555-4555-8555-555555555555",
        text: "不会伪装成功",
        type: "create_text",
        x: 0,
        y: 0,
      },
    })).rejects.toThrow("quota full");
    expect(sinkState.view.nodes).toHaveLength(1);
    expect(sinkState.statuses.at(-1)).toBe("local_recovery_unavailable");
  });

  test("响应丢失后复用同一 mutation_id 重试，自由文字只出现一次", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    const requests: CanvasMutationRequest[] = [];
    const waits: number[] = [];
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: memory,
      wait: async (milliseconds) => { waits.push(milliseconds); },
      transport: {
        async commitExpansion(request) { return resultFor(request); },
        async getCanvas() { return detail(); },
        keepalive() { return false; },
        async mutate(request) {
          requests.push(request);
          if (requests.length === 1) {
            throw new ApiError(0, "NETWORK_ERROR", "response lost");
          }
          return resultFor(request);
        },
      },
    });
    await coordinator.recover(detail());
    const nodeId = "55555555-5555-4555-8555-555555555555";
    await coordinator.enqueue({
      operation: { node_id: nodeId, text: "只出现一次", type: "create_text", x: 1, y: 2 },
    });
    const flushed = await coordinator.flush();

    expect(flushed).toEqual({ persisted: true, synced: true });
    expect(requests).toHaveLength(2);
    expect(requests[0]!.mutation_id).toBe(requests[1]!.mutation_id);
    expect(waits).toEqual([500]);
    expect(sinkState.server.nodes.filter((node) => node.id === nodeId)).toHaveLength(1);
    expect(memory.records.size).toBe(0);
  });

  test("409 只重放一次并保留不相关远端节点", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    const remote = detail(3);
    remote.nodes.push({
      created_by: "user",
      discovered_from_id: null,
      height: 120,
      id: "66666666-6666-4666-8666-666666666666",
      kind: "native",
      snapshot_excerpt: null,
      snapshot_revision: null,
      snapshot_title: null,
      target: null,
      target_node_id: null,
      text: "远端新增",
      text_scale: 1,
      width: 240,
      x: 100,
      y: 100,
    });
    const requests: CanvasMutationRequest[] = [];
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: memory,
      transport: {
        async commitExpansion(request) { return resultFor(request); },
        async getCanvas() { return remote; },
        keepalive() { return false; },
        async mutate(request) {
          requests.push(request);
          if (requests.length === 1) {
            throw new ApiError(
              409,
              "CANVAS_VERSION_CONFLICT",
              "changed",
              { version: 3 },
            );
          }
          return resultFor(request, 4);
        },
      },
    });
    await coordinator.recover(detail());
    await coordinator.enqueue({
      operation: { node_id: ROOT_ID, type: "update_node", x: 42, y: 24 },
    });
    await coordinator.flush();

    expect(requests.map((request) => request.base_version)).toEqual([1, 3]);
    expect(requests[0]!.mutation_id).toBe(requests[1]!.mutation_id);
    expect(sinkState.server.nodes.some((node) => node.text === "远端新增")).toBe(true);
    expect(sinkState.server.nodes.find((node) => node.id === ROOT_ID))
      .toMatchObject({ x: 42, y: 24 });
  });

  test("AI 等待期间的人工草稿先封装，expansion 严格接在其版本之后", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    const calls: Array<{ baseVersion: number; kind: "human" | "ai" }> = [];
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: memory,
      transport: {
        async commitExpansion(request) {
          calls.push({ baseVersion: request.base_version, kind: "ai" });
          return resultFor(request);
        },
        async getCanvas() { return detail(); },
        keepalive() { return false; },
        async mutate(request) {
          calls.push({ baseVersion: request.base_version, kind: "human" });
          return resultFor(request);
        },
      },
    });
    await coordinator.recover(detail());
    await coordinator.enqueue({
      operation: { node_id: ROOT_ID, type: "update_node", x: 8, y: 12 },
    });
    await coordinator.enqueueExpansion([], {
      candidate_revisions: [],
      completion_status: "complete",
      corpus_version: 4,
      request_id: "99999999-9999-4999-8999-999999999999",
      source_canvas_node_id: ROOT_ID,
      source_revision: 1,
    });

    expect(await coordinator.flush()).toEqual({ persisted: true, synced: true });
    expect(calls).toEqual([
      { baseVersion: 1, kind: "human" },
      { baseVersion: 2, kind: "ai" },
    ]);
    expect(await memory.list({ canvasId: CANVAS_ID, userId: USER_ID })).toEqual([]);
  });

  test("pagehide 只发一批不超过 48KiB，剩余 mutation 继续留在 WAL", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    const keepalives: CanvasMutationRequest[] = [];
    const coordinator = new CanvasSaveCoordinator({
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: memory,
      transport: {
        async commitExpansion(request) { return resultFor(request); },
        async getCanvas() { return detail(); },
        keepalive(request) {
          keepalives.push(request);
          return true;
        },
        async mutate(request) { return resultFor(request); },
      },
    });
    await coordinator.recover(detail());

    for (let index = 0; index < 12; index += 1) {
      await coordinator.enqueue({
        operation: {
          node_id: crypto.randomUUID(),
          text: String(index).padEnd(4900, "字"),
          type: "create_text",
          x: index * 10,
          y: index * 10,
        },
      });
    }

    coordinator.flushForPageHide();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(keepalives).toHaveLength(1);
    expect(canvasMutationByteLength({
      base_version: keepalives[0]!.base_version,
      intents: keepalives[0]!.operations.map((operation) => ({ operation })),
      mutation_id: keepalives[0]!.mutation_id,
    })).toBeLessThanOrEqual(CANVAS_KEEPALIVE_MAX_BYTES);
    const records = await memory.list({ canvasId: CANVAS_ID, userId: USER_ID });
    expect(records.filter((record) => record.kind === "mutation").length)
      .toBeGreaterThan(1);
    expect(records.some((record) => record.kind === "draft")).toBe(false);
    coordinator.dispose();
  });

  test("源 revision 漂移时只丢弃纯 AI mutation，刷新服务端快照且不留下幽灵节点", async () => {
    const memory = createMemoryCanvasWalStorage();
    const sinkState = createSink(detail());
    let discarded = 0;
    const coordinator = new CanvasSaveCoordinator({
      onDiscardedExpansion() { discarded += 1; },
      scope: { canvasId: CANVAS_ID, userId: USER_ID },
      sink: sinkState.sink,
      storage: memory,
      transport: {
        async commitExpansion() {
          throw new ApiError(
            409,
            "CANVAS_SOURCE_REVISION_CONFLICT",
            "source changed",
          );
        },
        async getCanvas() { return detail(2); },
        keepalive() { return false; },
        async mutate(request) { return resultFor(request); },
      },
    });
    await coordinator.recover(detail());
    const aiNodeId = "77777777-7777-4777-8777-777777777777";
    await coordinator.enqueueExpansion([{
      operation: {
        node_id: aiNodeId,
        target_node_id: "88888888-8888-4888-8888-888888888888",
        type: "add_memo",
        x: 100,
        y: 100,
      },
    }], {
      candidate_revisions: [{
        memo_id: "88888888-8888-4888-8888-888888888888",
        revision: 1,
      }],
      completion_status: "complete",
      corpus_version: 4,
      request_id: "99999999-9999-4999-8999-999999999999",
      source_canvas_node_id: ROOT_ID,
      source_revision: 1,
    });
    expect(await coordinator.flush()).toEqual({ persisted: true, synced: true });
    expect(discarded).toBe(1);
    expect(sinkState.view.nodes.some((node) => node.id === aiNodeId)).toBe(false);
    expect(await memory.list({ canvasId: CANVAS_ID, userId: USER_ID })).toEqual([]);
  });
});
