/**
 * [INPUT]: 依赖 Bun test、splitStreamingTextUnits 的 Unicode 分词结果与 StreamingText 的直出时间轴/进度样式
 * [OUTPUT]: 验证英文、中文及 Markdown 标记不丢失，千词不经过显示队列，并锁定五词拖尾与 DOM 重组后的负延迟续播
 * [POS]: design-system AI 流式文字的纯逻辑回归测试，锁定跨语言分词、网络吞吐与视觉动效彻底解耦
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  activeResolvingWordStyles,
  advanceStreamingWordTimeline,
  resolvingWordStyle,
} from "./StreamingText";
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

  test("accepts a thousand arriving units immediately and animates only the tail five", () => {
    const units = Array.from({ length: 1_000 }, (_, index) => `词${index}`);
    const timeline = advanceStreamingWordTimeline(
      { units: [], revealedAt: [] },
      units,
      1_000,
      true,
    );

    expect(timeline.units).toHaveLength(1_000);
    expect(timeline.units).toEqual(units);
    expect(activeResolvingWordStyles(timeline, 1_000)).toEqual([
      { animationDelay: "0ms" },
      { animationDelay: "-55ms" },
      { animationDelay: "-110ms" },
      { animationDelay: "-165ms" },
      { animationDelay: "-220ms" },
    ]);
  });

  test("keeps resolved prefix timing when the next SSE chunk appends", () => {
    const previous = {
      units: ["已经", "稳定。"],
      revealedAt: [100, 155],
    };
    const timeline = advanceStreamingWordTimeline(
      previous,
      ["已经", "稳定。", "继续"],
      300,
      true,
    );

    expect(timeline.revealedAt).toEqual([100, 155, 300]);
  });
});
