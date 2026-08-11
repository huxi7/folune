/**
 * [INPUT]: 依赖 Bun test 与 splitStreamingTextUnits 的 Unicode 分词结果
 * [OUTPUT]: 验证英文、中文及 Markdown 标记在按词流式显示时不丢失原文
 * [POS]: design-system AI 流式文字的纯逻辑回归测试，锁定跨语言节奏与字符保真边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { splitStreamingTextUnits } from "./streamingTextSegments";

describe("splitStreamingTextUnits", () => {
  test("groups English punctuation and spaces with the preceding word", () => {
    expect(splitStreamingTextUnits("Pistachio is fast.")).toEqual([
      "Pistachio ",
      "is ",
      "fast.",
    ]);
  });

  test("segments Chinese into readable word groups instead of one sentence", () => {
    expect(splitStreamingTextUnits("当然。先确认目标。")).toEqual([
      "当然。",
      "先",
      "确认",
      "目标。",
    ]);
  });

  test("preserves Markdown markers and the exact source text", () => {
    const source = "**hello** world";
    const units = splitStreamingTextUnits(source);

    expect(units).toEqual(["**hello** ", "world"]);
    expect(units.join("")).toBe(source);
  });
});
