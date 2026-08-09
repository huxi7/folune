/**
 * [INPUT]: 依赖 Bun test 与 MarkdownEditor 的 inflate/deflate 纯显示协议适配函数
 * [OUTPUT]: 覆盖普通文本、2/5+ 空行、首尾/连续空格、强调 Markdown、CRLF 与 UI 标记不落库的 round-trip 回归测试
 * [POS]: app/src/widgets 的 Markdown 编辑器适配契约测试；以数据库字符串恒等往返作为唯一正确性判据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  deflateEditorBlankLineMarkers,
  inflateMarkdownBlankLines,
} from "./MarkdownEditor";

const cases = [
  ["普通文本", "普通文本"],
  ["段落之间两个空行", "第一段\n\n\n第二段"],
  ["段落之间五个以上空行", `第一段${"\n".repeat(7)}第二段`],
  ["行首和行尾空格", "  缩进文本  \n下一行   "],
  ["行中连续空格", "one    two        three"],
  ["强调段之间多个空行", "**加粗**\n\n\n\n***斜体加粗***"],
  ["只含空格的空白行", "上方\n   \n\t\n下方"],
  ["CRLF 换行", "上方\r\n\r\n\r\n下方"],
] as const;

describe("MarkdownEditor blank-line adapter", () => {
  test.each(cases)("round-trips %s without changing markdown", (_name, value) => {
    expect(
      deflateEditorBlankLineMarkers(inflateMarkdownBlankLines(value)),
    ).toBe(value);
  });

  test("inflates blank visual paragraphs without HTML hacks", () => {
    const inflated = inflateMarkdownBlankLines("上方\n\n\n下方");

    expect(inflated).toContain("\u200B");
    expect(inflated).not.toContain("&nbsp;");
    expect(inflated).not.toContain("<p>");
    expect(inflated).not.toContain("<br");
  });

  test("deflates every editor marker before content leaves the adapter", () => {
    const databaseValue = deflateEditorBlankLineMarkers(
      "\u200B\n  \u200B\n正文\u200B",
    );

    expect(databaseValue).toBe("\n  \n正文");
    expect(databaseValue).not.toContain("\u200B");
  });

  test("keeps a truly empty memo empty so the placeholder remains visible", () => {
    expect(inflateMarkdownBlankLines("")).toBe("");
    expect(deflateEditorBlankLineMarkers("")).toBe("");
  });
});
