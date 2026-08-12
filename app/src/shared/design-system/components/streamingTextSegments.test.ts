/**
 * [INPUT]: 依赖 Bun test、splitStreamingTextUnits 的 Unicode 分词结果与 StreamingText 的时间进度样式
 * [OUTPUT]: 验证英文、中文及 Markdown 标记不丢失，并锁定 DOM 重组后以负延迟续播模糊进度
 * [POS]: design-system AI 流式文字的纯逻辑回归测试，锁定跨语言节奏、字符保真与无重闪时间边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { resolvingWordStyle } from "./StreamingText";
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

describe("resolvingWordStyle", () => {
  test("resumes remounted words from their elapsed blur progress", () => {
    expect(resolvingWordStyle(0)).toEqual({ animationDelay: "0ms" });
    expect(resolvingWordStyle(165)).toEqual({ animationDelay: "-165ms" });
  });
});
