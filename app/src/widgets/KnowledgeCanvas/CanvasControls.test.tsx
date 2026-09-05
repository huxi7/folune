/**
 * [INPUT]: 依赖 React 服务端渲染、ReactFlowProvider 与真实 CanvasControls
 * [OUTPUT]: 锁定一个 Panel、两个同材质独立 surface、图标化加入动作及 fit/ZoomOut/ZoomIn/info 视口顺序
 * [POS]: KnowledgeCanvas 的底部命令形制回归门禁；不挂载 Canvas 数据，不测试 React Flow 视口实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasControls } from "./CanvasControls";

const html = renderToStaticMarkup(
  <ReactFlowProvider>
    <CanvasControls
      onAdd={() => undefined}
      onFit={() => undefined}
      onZoomIn={() => undefined}
      onZoomOut={() => undefined}
    />
  </ReactFlowProvider>,
);

describe("CanvasControls", () => {
  test("一个 Panel 只负责定位，内部恰好两个独立 surface", () => {
    expect(html.match(/react-flow__panel/g)).toHaveLength(1);
    expect(html.match(/data-surface=/g)).toHaveLength(2);
    expect(html).toContain('data-surface="content"');
    expect(html).toContain('data-surface="viewport"');
  });

  test("加入笔记只保留语义图标与可访问名称，不再常驻 Tonal 底色", () => {
    expect(html).toContain('aria-label="加入笔记"');
    expect(html).toContain('title="加入笔记"');
    expect(html).not.toContain('data-variant="tonal"');
    expect(html).not.toContain("加入笔记</span>");
    expect(html).not.toContain("canvas-control-group-content");
  });

  test("视口动作顺序稳定为适配、缩小、放大、说明", () => {
    const labels = [...html.matchAll(/aria-label="(适配视图|缩小|放大|操作说明)"/g)]
      .map((match) => match[1]);
    expect(labels).toEqual(["适配视图", "缩小", "放大", "操作说明"]);
  });
});
