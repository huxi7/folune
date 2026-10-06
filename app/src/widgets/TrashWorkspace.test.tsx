/**
 * [INPUT]: 依赖 React 服务端渲染、Bun test 与纯 TrashWorkspaceView props
 * [OUTPUT]: 覆盖回收站首帧延迟占位/empty/error/真实根列表、Folder 不展开、危险确认与提交锁 UI；计时由 Skeleton.test.tsx 验证
 * [POS]: app/src/widgets 的回收站纯视图回归测试，不发网络请求或挂载浏览器 DOM
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TrashWorkspaceView } from "./TrashWorkspaceView";

const folder = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  node_type: "folder" as const,
  title: "项目资料",
  parent_id: null,
  original_path: "工作",
  deleted_at: "2026-08-09T08:00:00.000Z",
  excerpt: null,
};

const renderView = (
  status: "empty" | "error" | "loading" | "ready",
  options: {
    busyAction?: { kind: "clear" } | null;
    confirmation?: { kind: "clear" } | { kind: "permanent"; item: typeof folder } | null;
    items?: typeof folder[];
  } = {},
) => renderToStaticMarkup(createElement(TrashWorkspaceView, {
  busyAction: options.busyAction ?? null,
  confirmation: options.confirmation ?? null,
  items: options.items ?? [],
  onCloseConfirmation: () => undefined,
  onConfirmClear: () => undefined,
  onConfirmPermanent: () => undefined,
  onRequestClear: () => undefined,
  onRequestPermanent: () => undefined,
  onRestore: () => undefined,
  onRetry: () => undefined,
  status,
}));

describe("TrashWorkspaceView", () => {
  test("renders loading, empty, and retryable error states", () => {
    const loadingHtml = renderView("loading");
    expect(loadingHtml).toContain("trash-loading-list");
    expect(loadingHtml).toContain('data-visible="false"');
    expect(loadingHtml).not.toContain('role="status"');
    expect(renderView("empty")).toContain("回收站是空的");
    const errorHtml = renderView("error");
    expect(errorHtml).toContain("回收站加载失败");
    expect(errorHtml).toContain("重试");
  });

  test("renders only the supplied Folder root without descendant rows", () => {
    const html = renderView("ready", { items: [folder] });

    expect(html).toContain("项目资料");
    expect(html).toContain("原位置：工作");
    expect(html).toContain("文件夹");
    expect(html).not.toContain("内部备忘录");
  });

  test("uses shared dialogs for permanent delete and current-user clear", () => {
    const permanentHtml = renderView("ready", {
      confirmation: { kind: "permanent", item: folder },
      items: [folder],
    });
    expect(permanentHtml).toContain("内部所有文件夹、备忘录和正文");
    expect(permanentHtml).toContain("操作不可恢复");

    const clearHtml = renderView("ready", {
      busyAction: { kind: "clear" },
      confirmation: { kind: "clear" },
      items: [folder],
    });
    expect(clearHtml).toContain("当前登录用户");
    expect(clearHtml).toContain("aria-busy=\"true\"");
    expect(clearHtml).toContain("disabled=\"\"");
  });
});
