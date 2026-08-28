/**
 * [INPUT]: 依赖 Bun test、react-dom/server、memoDocumentStore 初始状态与真实 CanvasPreviewOverlay
 * [OUTPUT]: 锁定"纸内只有正文、动作一律在纸外"的 DOM 契约：关闭与编辑原文都不在 .note-paper 内，因此正文长度永不影响入口可达性
 * [POS]: KnowledgeCanvas 的预览结构回归门禁；只断言结构归属，模态行为与几何由 Dialog/note-paper.css 拥有并在浏览器验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasPreviewOverlay } from "./CanvasPreviewOverlay";

const html = renderToStaticMarkup(
  <CanvasPreviewOverlay
    accessToken="test-token"
    memoId="memo-1"
    onClose={() => undefined}
    onEditOriginal={async () => undefined}
    title="少则得"
  />,
);

/** 纸的 DOM 范围: 从 .note-paper 开始到它的闭合标签为止 */
const paperMarkup = (): string => {
  const start = html.indexOf('<article class="note-paper"');
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('<div class="canvas-preview-tools"', start);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

describe("Canvas preview overlay", () => {
  test("遮罩中央只有一张 reader 纸，且复用 Dialog 的 bare 表面", () => {
    expect(html).toContain('data-surface="bare"');
    expect(html).toContain("ds-dialog-shell");
    expect(html).toContain('data-variant="reader"');
    // bare 表面不得出现通用弹窗的可见标题栏与关闭按钮
    expect(html).not.toContain("ds-dialog-panel");
    expect(html).not.toContain("关闭弹窗");
  });

  test("编辑原文与关闭都住在纸外工具列，不随正文滚动", () => {
    const paper = paperMarkup();

    expect(paper).not.toContain("canvas-preview-tool");
    expect(paper).not.toContain("编辑原文");
    expect(paper).not.toContain("关闭预览");

    const tools = html.slice(html.indexOf('<div class="canvas-preview-tools"'));
    expect(tools).toContain('aria-label="关闭预览"');
    expect(tools).toContain('aria-label="编辑原文"');
    // 工具列在纸之后: 视觉位置由 flex 决定，DOM 顺序保证读屏先读正文再读动作
    expect(html.indexOf("note-paper")).toBeLessThan(
      html.indexOf("canvas-preview-tools"),
    );
  });

  test("正文未到达时编辑原文不可点，但入口位置不变", () => {
    expect(html).toContain("正在读取原文");
    expect(html).toMatch(/aria-label="编辑原文"[^>]*disabled|disabled[^>]*aria-label="编辑原文"/);
  });
});
