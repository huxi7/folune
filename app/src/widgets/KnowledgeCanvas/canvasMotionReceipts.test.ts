/**
 * [INPUT]: 依赖 Bun test、happy-dom、Canvas Flow UI 数据与 canvasMotionReceipts 瞬时投影/快照
 * [OUTPUT]: 锁定 AI/手动/连接 receipt 的来源确认、32ms/128ms 有界 stagger、方向偏移、节点查找与无身份删除快照
 * [POS]: KnowledgeCanvas 的因果动效回归门禁；证明持久文档本身不携带 motionState，只有本地手势临时装饰 Flow data
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { CanvasFlowEdge, CanvasFlowNode } from "../../pages/canvasPresentation";
import {
  applyCanvasMotionReceipt,
  captureCanvasRemovalSnapshots,
  createCanvasMotionReceipt,
  findCanvasNodeElement,
} from "./canvasMotionReceipts";

const browserWindow = new Window({ url: "http://localhost:10000/app/canvas/test" });
Object.assign(globalThis, {
  document: browserWindow.document,
  window: browserWindow,
});

afterEach(() => browserWindow.document.body.replaceChildren());

const node = (id: string, x: number, y: number): CanvasFlowNode => ({
  data: {
    body: null,
    createdBy: "user",
    discoveredFromId: null,
      kind: "memo_ref",
    targetDeleted: false,
    targetNodeId: `memo-${id}`,
    textHeight: null,
    textScale: 1,
    textWidth: null,
    title: id,
    tombstone: false,
  },
  id,
  position: { x, y },
  type: "canvasNode",
});

const edge = (id: string, source: string, target: string): CanvasFlowEdge => ({
  data: { createdBy: "ai", rationale: null },
  id,
  source,
  target,
  type: "cord",
});

describe("Canvas motion receipts", () => {
  test("AI 拓展只装饰来源、新节点和新关系，并按 32ms 展开", () => {
    const receipt = createCanvasMotionReceipt({
      edgeIds: ["e-1", "e-2"],
      kind: "ai_expand",
      nodeIds: ["new-1", "new-2"],
      sourceNodeId: "source",
    });
    const projected = applyCanvasMotionReceipt(
      [
        node("source", 0, 0),
        node("old", -500, 0),
        node("new-1", 300, 0),
        node("new-2", 300, 300),
      ],
      [edge("old-edge", "source", "old"), edge("e-1", "source", "new-1"), edge("e-2", "source", "new-2")],
      receipt,
    );

    expect(projected.nodes.find((item) => item.id === "source")?.data.motionState?.kind)
      .toBe("source-confirm");
    expect(projected.nodes.find((item) => item.id === "old")?.data.motionState)
      .toBeUndefined();
    expect(projected.nodes.find((item) => item.id === "new-1")?.data.motionState)
      .toMatchObject({ delayMs: 100, kind: "node-enter", offsetX: -12, offsetY: 0 });
    expect(projected.nodes.find((item) => item.id === "new-2")?.data.motionState?.delayMs)
      .toBe(132);
    expect(projected.edges.find((item) => item.id === "old-edge")?.data?.motionState)
      .toBeUndefined();
    expect(projected.edges.find((item) => item.id === "e-1")?.data?.motionState?.delayMs)
      .toBe(40);
    expect(projected.edges.find((item) => item.id === "e-2")?.data?.motionState?.delayMs)
      .toBe(72);
  });

  test("人工连线不让任一节点入场", () => {
    const projected = applyCanvasMotionReceipt(
      [node("a", 0, 0), node("b", 300, 0)],
      [edge("e", "a", "b")],
      createCanvasMotionReceipt({
        edgeIds: ["e"],
        kind: "connect",
        nodeIds: [],
        sourceNodeId: "a",
      }),
    );

    expect(projected.nodes.every((item) => item.data.motionState === undefined)).toBe(true);
    expect(projected.edges[0]?.data?.motionState?.kind).toBe("edge-draw");
  });

  test("多结果错峰最多延后 128ms", () => {
    const nodeIds = Array.from({ length: 6 }, (_, index) => `new-${index}`);
    const edgeIds = Array.from({ length: 6 }, (_, index) => `edge-${index}`);
    const projected = applyCanvasMotionReceipt(
      [node("source", 0, 0), ...nodeIds.map((id, index) => node(id, 300, index * 300))],
      edgeIds.map((id, index) => edge(id, "source", nodeIds[index]!)),
      createCanvasMotionReceipt({
        edgeIds,
        kind: "ai_expand",
        nodeIds,
        sourceNodeId: "source",
      }),
    );

    expect(projected.nodes.find((item) => item.id === "new-5")?.data.motionState?.delayMs)
      .toBe(228);
    expect(projected.edges.find((item) => item.id === "edge-5")?.data?.motionState?.delayMs)
      .toBe(168);
  });

  test("删除快照不依赖 CSS.escape、不复制身份，且按布局尺寸乘 zoom 落位", () => {
    const source = document.createElement("div");
    source.className = "react-flow__node";
    source.dataset.id = 'node-"quoted';
    source.innerHTML = '<button id="node-action" data-id="nested">删除</button>';
    source.getBoundingClientRect = () => ({
      bottom: 140,
      height: 120,
      left: 20,
      right: 220,
      top: 20,
      width: 200,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    });
    /* 画布 zoom 0.5: 布局 400x240, 屏幕上只有 200x120 */
    Object.defineProperties(source, {
      offsetHeight: { configurable: true, value: 240 },
      offsetWidth: { configurable: true, value: 400 },
    });
    document.body.append(source);

    expect(findCanvasNodeElement(document, 'node-"quoted')).toBe(source);
    const play = captureCanvasRemovalSnapshots(['node-"quoted'], false);
    const snapshot = document.querySelector<HTMLElement>(".canvas-removal-snapshot");

    expect(snapshot).not.toBeNull();
    expect(snapshot?.hasAttribute("data-id")).toBe(false);
    expect(snapshot?.querySelector("[data-id]")).toBeNull();
    expect(snapshot?.querySelector("[id]")).toBeNull();
    expect(snapshot?.getAttribute("aria-hidden")).toBe("true");
    expect(snapshot?.hasAttribute("inert")).toBe(true);
    /*
     * 快照按布局尺寸排版再乘卡片自身的 zoom。若照屏幕矩形钉宽高(200x120), 版面会被挤窄
     * 而字号照旧, 删除那一下字会先胀大再淡掉 —— 与纸面过渡那一层是同一类错。
     */
    expect([snapshot?.style.width, snapshot?.style.height]).toEqual(["400px", "240px"]);
    expect(snapshot?.style.transform).toBe("translate(0px, 0px) scale(0.5)");
    expect([snapshot?.style.left, snapshot?.style.top]).toEqual(["20px", "20px"]);

    play();
    source.remove();
    snapshot?.remove();
  });
});
