/**
 * [INPUT]: 读取 CanvasElasticConnectionLine 源码的坐标来源契约
 * [OUTPUT]: 锁定临时绳起点是 React Flow 给的抓手坐标、终点是真实指针，绝不消费被 handle 吸附过的 toX/toY
 * [POS]: KnowledgeCanvas 拖拽连接的坐标所有权门禁；波形数学归 elasticCordGeometry.test，命中与层叠归 canvasConnectionPresentation.test
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dir, "CanvasElasticConnectionLine.tsx"),
  "utf8",
);

describe("CanvasElasticConnectionLine", () => {
  test("起点是抓手本身: fromX/fromY 直接进几何，不再对来源卡片求边界锚点", () => {
    expect(source).toContain("from: { x: latest.fromX, y: latest.fromY }");
    // cordAnchor 是「已成立的关系属于整张卡片」的算法, 属于 CanvasCordEdge, 不属于手势
    expect(source).not.toContain("cordAnchor");
    expect(source).not.toContain("sourceBox");
  });

  test("终点是真实指针: 吸附只决定连给谁，不决定线画到哪", () => {
    /*
     * whole-card target 的中心就是卡片正中, React Flow 一吸附就把 connection.to 换成它,
     * 线于是贯穿目标卡片的正文。pointer 是容器坐标, 必须用 viewport transform 反解。
     */
    expect(source).toContain("pointer: pointerInFlow(");
    expect(source).toContain("(pointer.x - translateX) / zoom");
    expect(source).toContain("(pointer.y - translateY) / zoom");
    expect(source).toContain("useStore((state) => state.transform)");
  });

  test("toX/toY 只作为 pointer 缺席时的兜底，不参与正常路径", () => {
    const fallback = source.slice(source.indexOf("const pointerInFlow"));
    expect(fallback).toContain("if (pointer === undefined) return fallback;");
    expect(source).toContain("x: latest.toX,");
  });
});
