/**
 * [INPUT]: 依赖 React 服务端渲染、Bun test 与 WorkspaceLibraryLayer 的持久挂载契约
 * [OUTPUT]: 证明文件库内容在开合两种状态都留在同一宿主 DOM 中，关闭只改变可见/交互语义而不是卸载子树
 * [POS]: widgets 的持久文件库宿主回归测试；与真实 AppSidebar 解耦，只锁定路由切换不应破坏的组件边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceLibraryLayer } from "./WorkspaceLibraryLayer";

const renderLayer = (open: boolean) => renderToStaticMarkup(
  <WorkspaceLibraryLayer open={open} style={{}}>
    <aside>Library panel</aside>
  </WorkspaceLibraryLayer>,
);

describe("WorkspaceLibraryLayer", () => {
  test("关闭时仍保留文件库子树，只冻结交互", () => {
    const closed = renderLayer(false);
    const opened = renderLayer(true);

    expect(closed).toContain("workspace-persistent-panel");
    expect(closed).toContain("Library panel");
    expect(closed).toContain('aria-hidden="true"');
    expect(opened).toContain("Library panel");
    expect(opened).toContain('aria-hidden="false"');
  });
});
