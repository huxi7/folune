/**
 * [INPUT]: 依赖 React 静态渲染、生产语义图标注册表与 Design System iconCatalog
 * [OUTPUT]: 锁定加入、缩放、连接抓手、AI 整理、AI 拓展六类出口全部陈列且字形互不复用
 * [POS]: DesignSystemWorkspace 的图标语义契约测试；阻止 Plus 或 Wand 再次跨命令承担多义职责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AddNoteIcon,
  ConnectionHandleIcon,
  ExpandFromNoteIcon,
  OrganizeNoteIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../../shared/design-system/icons";
import { iconographyCatalog } from "./iconCatalog";

const semanticIcons = [
  ["AddNoteIcon", AddNoteIcon],
  ["ZoomInIcon", ZoomInIcon],
  ["ZoomOutIcon", ZoomOutIcon],
  ["ConnectionHandleIcon", ConnectionHandleIcon],
  ["OrganizeNoteIcon", OrganizeNoteIcon],
  ["ExpandFromNoteIcon", ExpandFromNoteIcon],
] as const;

describe("一字形一语义", () => {
  test("展示清单保持轻量", () => {
    expect(iconographyCatalog.length).toBeLessThanOrEqual(12);
    expect(new Set(iconographyCatalog.map((item) => item.group))).toEqual(new Set(["Core production"]));
  });

  test("六类冻结语义全部进入生产图标清单", () => {
    const catalogNames = new Set(iconographyCatalog.map((item) => item.exportName));
    expect(semanticIcons.every(([name]) => catalogNames.has(name))).toBe(true);
  });

  test("六类冻结语义渲染为六个不同字形", () => {
    const glyphs = semanticIcons.map(([, Icon]) =>
      renderToStaticMarkup(createElement(Icon, { size: 16 })),
    );
    expect(new Set(glyphs).size).toBe(semanticIcons.length);
  });
});
