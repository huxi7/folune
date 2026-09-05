/**
 * [INPUT]: 依赖 React 服务端渲染、ArchiveStatus/WorkspaceOrganizePresentation 与 workspace.css 的 Rest 材质契约
 * [OUTPUT]: 锁定可见文案是「归档于〈末级目录〉」、完整路径进入 accessible name/title、暴露稳定 source 标记、Rest 无填充/描边/状态圆点，以及无 presentation 时完全不占位
 * [POS]: Paper Toolbar 归档状态元素回归门禁；不创建归档线、不读取文件树
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ArchiveStatus } from "./ArchiveStatus";
import type { WorkspaceOrganizePresentation } from "./archiveCordPolicy";

const presentation: WorkspaceOrganizePresentation = {
  memoId: "memo-1",
  origin: "fresh",
  path: "系统设计 / 形制收口",
  runId: "run-1",
  status: "succeeded",
};
const css = readFileSync(join(import.meta.dir, "../styles/workspace.css"), "utf8");

describe("ArchiveStatus", () => {
  test("完整路径进入 accessible name/title，视觉文本只显示末级落点", () => {
    const html = renderToStaticMarkup(createElement(ArchiveStatus, {
      onLocate: () => undefined,
      presentation,
    }));
    expect(html).toContain('data-archive-source="true"');
    expect(html).toContain('aria-label="归档于 系统设计 / 形制收口"');
    expect(html).toContain('title="归档于 系统设计 / 形制收口"');
    expect(html).toContain("归档于形制收口");
    expect(html).not.toContain(">归档于 系统设计 / 形制收口<");
  });

  test("根目录结果给出稳定的人话标签", () => {
    expect(renderToStaticMarkup(createElement(ArchiveStatus, {
      onLocate: () => undefined,
      presentation: { ...presentation, path: "根目录" },
    }))).toContain("归档于根目录");
  });

  test("source 自身不画状态圆点、端口或 Badge 身体", () => {
    const html = renderToStaticMarkup(createElement(ArchiveStatus, {
      onLocate: () => undefined,
      presentation,
    }));
    expect(html).not.toContain("archive-status-dot");
    expect(css).not.toContain("archive-status-dot");
    // Rest 只有文字: 无填充、无描边、无外影
    expect(css).toContain("border: 0; border-radius: var(--button-radius); background: transparent;");
    expect(css).toContain(".archive-status:hover { background: var(--interactive-hover); color: var(--foreground); }");
  });

  test("没有 presentation 时不渲染状态元素，因此不挤动右侧命令区", () => {
    expect(renderToStaticMarkup(createElement(ArchiveStatus, {
      onLocate: () => undefined,
      presentation: null,
    }))).toBe("");
  });
});
