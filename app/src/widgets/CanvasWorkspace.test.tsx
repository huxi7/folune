/**
 * [INPUT]: 依赖 React 服务端渲染、Bun test 与 CanvasWorkspace 的 Chrome/会话 props
 * [OUTPUT]: 锁定 Canvas 独立中央空间、返回/标题入口与共享 Panel 插槽，且绝不夹带 Paper
 * [POS]: widgets 的 CanvasWorkspace 壳回归测试；不请求 Canvas 数据，只验证空间与组件所有权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasWorkspace } from "./CanvasWorkspace";

describe("CanvasWorkspace", () => {
  test("renders Canvas in the shared Chrome without Paper", () => {
    const html = renderToStaticMarkup(createElement(CanvasWorkspace, {
      accessToken: "test-token",
      assistant: createElement("aside", null, "AI panel"),
      canvasId: "canvas-1",
      initialAssistantOpen: true,
      initialLibraryOpen: true,
      library: createElement("aside", null, "Library panel"),
      onExit: () => undefined,
      onNavigateMemo: () => undefined,
      style: {},
      title: "可逆的动作用户才敢用",
      userId: "user-1",
    }));

    expect(html).toContain("canvas-workspace");
    expect(html).toContain('aria-label="返回笔记"');
    expect(html).toContain("可逆的动作用户才敢用");
    expect(html).not.toContain("paper-workspace");
    expect(html).toContain("Library panel");
    expect(html).toContain("AI panel");
  });
});
