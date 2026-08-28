/**
 * [INPUT]: 依赖 Bun test、Canvas V2 文档 fixture 与 canvasDocument 纯函数
 * [OUTPUT]: 覆盖高频操作合并、乐观投影、默认根脱离、无向边去重、dropped 与 alias 回执归一
 * [POS]: shared/store 的 Canvas documentSlice 回归门禁；线上、恢复和冲突重放必须得到同一结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type {
  CanvasDetail,
  CanvasMutationResult,
} from "../api/canvas";
import {
  applyCanvasIntents,
  applyCanvasMutationResult,
  normalizeCanvasIntents,
  type CanvasIntent,
} from "./canvasDocument";

const detail = (): CanvasDetail => ({
  canvas: {
    canvas_kind: "memo_default",
    created_at: "",
    metadata: {},
    node_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    origin_node_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    origin_revision: 1,
    updated_at: "",
    user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    version: 1,
    viewport: {},
  },
  edges: [],
  node: {} as CanvasDetail["node"],
  nodes: [{
    created_by: "user",
    discovered_from_id: null,
    height: null,
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    kind: "memo_ref",
    snapshot_excerpt: "根",
    snapshot_revision: 1,
    snapshot_title: "根",
    target: {
      deleted_at: null,
      excerpt: "根",
      node_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      revision: 1,
      title: "根",
    },
    target_node_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    text: null,
    text_scale: null,
    width: null,
    x: 0,
    y: 0,
  }],
});
describe("normalizeCanvasIntents", () => {
  test("创建后的文字/尺寸更新并入稳定 UUID，视口只保留最后一份", () => {
    const nodeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const intents: CanvasIntent[] = [
      { operation: { node_id: nodeId, text: "初稿", type: "create_text", x: 0, y: 0 } },
      { operation: {
        height: 180,
        node_id: nodeId,
        text: "定稿",
        text_scale: 1.5,
        type: "update_node",
        width: 360,
      } },
      { operation: { type: "set_viewport", viewport: { x: 0, y: 0, zoom: 1 } } },
      { operation: { type: "set_viewport", viewport: { x: 2, y: 3, zoom: 0.8 } } },
    ];

    const normalized = normalizeCanvasIntents(intents);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]!.operation).toMatchObject({
      node_id: nodeId,
      text: "定稿",
      height: 180,
      text_scale: 1.5,
      type: "create_text",
      width: 360,
    });
    expect(normalized[1]!.operation).toEqual({
      type: "set_viewport",
      viewport: { x: 2, y: 3, zoom: 0.8 },
    });
  });

  test("create+remove 不在客户端自作聪明删除，由数据库给出 no-op", () => {
    const nodeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const normalized = normalizeCanvasIntents([
      { operation: { node_id: nodeId, text: "x", type: "create_text", x: 0, y: 0 } },
      { operation: { node_id: nodeId, type: "remove_node" } },
    ]);
    expect(normalized.map((item) => item.operation.type))
      .toEqual(["create_text", "remove_node"]);
  });
});

describe("Canvas document projection", () => {
  test("移除默认根同时清边并把 Canvas 留作 standalone", () => {
    const rootId = detail().nodes[0]!.id;
    const projected = applyCanvasIntents(detail(), [{
      operation: { node_id: rootId, type: "remove_node" },
    }]);
    expect(projected.nodes).toHaveLength(0);
    expect(projected.canvas).toMatchObject({
      canvas_kind: "standalone",
      origin_node_id: null,
      origin_revision: null,
    });
  });

  test("服务端 dropped 不固化，alias 把客户端稳定 ID 对账到既有 memo 节点", () => {
    const base = detail();
    const clientId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const canonicalId = base.nodes[0]!.id;
    const intents: CanvasIntent[] = [{
      hint: { title: "根" },
      operation: {
        node_id: clientId,
        target_node_id: base.nodes[0]!.target_node_id as string,
        type: "add_memo",
        x: 20,
        y: 20,
      },
    }, {
      operation: {
        node_id: canonicalId,
        text: "不能写 memo 卡",
        type: "update_node",
      },
    }];
    const result: CanvasMutationResult = {
      aliases: [{ client_id: clientId, node_id: canonicalId }],
      dropped: [{ index: 1, reason: "不是自由文字", type: "update_node" }],
      expansion_status: null,
      intent_digest: "a".repeat(64),
      mutation_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      noops: [],
      removed_edge_ids: [],
      removed_node_ids: [],
      upserted_edges: [],
      upserted_nodes: [],
      version: 2,
    };

    const confirmed = applyCanvasMutationResult(base, intents, result);
    expect(confirmed.nodes).toHaveLength(1);
    expect(confirmed.nodes[0]!.id).toBe(canonicalId);
    expect(confirmed.canvas.version).toBe(2);
  });
});
