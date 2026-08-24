/**
 * [INPUT]: 依赖 React 服务端渲染、Bun test 与 CanvasWorkspace 的纯壳层 props
 * [OUTPUT]: 锁定已保存画布必须独占全屏、保留返回/标题入口，且不夹带 Paper 或左右 Panel 的产品语义
 * [POS]: app/src/widgets 的 CanvasWorkspace 回归测试；不请求画布数据，只验证空间壳边界，内容加载另由 KnowledgeCanvas 负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasWorkspace } from "./CanvasWorkspace";

describe("CanvasWorkspace", () => {
  test("renders as an independent canvas shell without Paper or side panels", () => {
    const html = renderToStaticMarkup(createElement(CanvasWorkspace, {
      accessToken: "test-token",
      canvasId: "canvas-1",
      onExit: () => undefined,
      onSelectMemo: () => undefined,
      title: "可逆的动作用户才敢用",
    }));

    expect(html).toContain("canvas-workspace");
    expect(html).toContain('aria-label="返回笔记"');
    expect(html).toContain("可逆的动作用户才敢用");
    expect(html).not.toContain("paper-workspace");
    expect(html).not.toContain("app-sidebar");
    expect(html).not.toContain("agent-panel");
  });
});
