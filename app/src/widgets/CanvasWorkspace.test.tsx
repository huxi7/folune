/**
 * [INPUT]: 依赖 React 服务端渲染、Bun test 与 CanvasWorkspace 的 Chrome/会话 props
 * [OUTPUT]: 锁定 Canvas 独立中央空间、返回/标题入口与 AI Panel 插槽，且绝不夹带 Paper 或跨路由文件库
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
      onNavigateMemo: () => undefined,
      onRename: async () => undefined,
      // 返回描述是唯一不依赖视口断点的进入语境, 因此结构测试用它打开两侧 Panel
      restore: {
        assistantOpen: true,
        canvasId: "canvas-1",
        libraryOpen: true,
        selectedNodeId: null,
        title: "可逆的动作用户才敢用",
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      style: {},
      title: "可逆的动作用户才敢用",
      userId: "user-1",
    }));

    expect(html).toContain("canvas-workspace");
    expect(html).toContain("可逆的动作用户才敢用");
    expect(html).not.toContain("paper-workspace");
    expect(html).not.toContain("Library panel");
    expect(html).toContain("AI panel");
    // 顶层不再有伪返回按钮、Canvas 文字标识与包裹整组内容的厚重卡片
    expect(html).not.toContain('aria-label="返回笔记"');
    expect(html).not.toContain("canvas-workspace-nav");
    expect(html).not.toContain("canvas-workspace-heading");
  });
});
