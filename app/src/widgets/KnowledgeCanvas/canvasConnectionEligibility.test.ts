/**
 * [INPUT]: 依赖 Bun test、Canvas API 类型与 canvasConnectionEligibility 纯判据
 * [OUTPUT]: 锁定 memo_ref、非自身、非墓碑/回收站、无重复 pair 的单一连接规则与可区分失败原因
 * [POS]: KnowledgeCanvas 的连接规则单测；不挂载 React Flow，也不触碰 WAL
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { CanvasDetail, CanvasNode } from "../../shared/api/canvas";
import { canvasConnectionEligibility } from "./canvasConnectionEligibility";

const node = (
  id: string,
  overrides: Partial<CanvasNode> = {},
): CanvasNode => ({
  created_by: "user",
  discovered_from_id: null,
  height: null,
  id,
  kind: "memo_ref",
  snapshot_excerpt: null,
  snapshot_revision: 1,
  snapshot_title: id,
  target: {
    deleted_at: null,
    excerpt: null,
    node_id: `memo-${id}`,
    revision: 1,
    title: id,
  },
  target_node_id: `memo-${id}`,
  text: null,
  text_scale: null,
  width: null,
  x: 0,
  y: 0,
  ...overrides,
});

const detail = (nodes: CanvasNode[], edges: CanvasDetail["edges"] = []): CanvasDetail => ({
  edges,
  nodes,
} as CanvasDetail);

describe("canvasConnectionEligibility", () => {
  test("两张可用 memo_ref 且没有正式边时合法", () => {
    expect(canvasConnectionEligibility(detail([node("a"), node("b")]), "a", "b"))
      .toMatchObject({ valid: true });
  });

  test("自连、重复 pair 与反向重复分别给出稳定原因", () => {
    const nodes = [node("a"), node("b")];
    expect(canvasConnectionEligibility(detail(nodes), "a", "a"))
      .toEqual({ reason: "self", valid: false });
    const duplicate = detail(nodes, [{
      created_by: "user",
      id: "edge-1",
      rationale: null,
      source_id: "a",
      target_id: "b",
    }]);
    expect(canvasConnectionEligibility(duplicate, "a", "b"))
      .toEqual({ reason: "duplicate", valid: false });
    expect(canvasConnectionEligibility(duplicate, "b", "a"))
      .toEqual({ reason: "duplicate", valid: false });
  });

  test("native、墓碑和回收站目标都不可连接", () => {
    const native = node("native", { kind: "native", target: null, target_node_id: null });
    const tombstone = node("tombstone", { target: null, target_node_id: null });
    const deleted = node("deleted", {
      target: { ...node("x").target!, deleted_at: "2026-09-01T00:00:00Z" },
    });
    const nodes = [node("source"), native, tombstone, deleted];
    expect(canvasConnectionEligibility(detail(nodes), "source", "native"))
      .toEqual({ reason: "target-unavailable", valid: false });
    expect(canvasConnectionEligibility(detail(nodes), "source", "tombstone"))
      .toEqual({ reason: "target-unavailable", valid: false });
    expect(canvasConnectionEligibility(detail(nodes), "source", "deleted"))
      .toEqual({ reason: "target-unavailable", valid: false });
  });
});
