/**
 * [INPUT]: 依赖 Bun test 与 useMemoAutosave 导出的纯字符计数、失败重试工具
 * [OUTPUT]: 对外提供等长替换计数、32 字阈值基础和 400/800/1600ms 有界退避回归测试
 * [POS]: app/src/widgets 的自动保存状态机纯逻辑测试边界，避免依赖 React DOM 即可锁定高频输入与弱网重试参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  AUTOSAVE_CHAR_THRESHOLD,
  countChangedCharacters,
  saveWithRetry,
} from "./useMemoAutosave";

describe("memo autosave", () => {
  test("counts insertion, deletion, and equal-length replacement", () => {
    expect(countChangedCharacters("abc", "abcdef")).toBe(3);
    expect(countChangedCharacters("abcdef", "ab")).toBe(4);
    expect(countChangedCharacters("abc", "abd")).toBe(1);
    expect(countChangedCharacters("", "x".repeat(32))).toBe(
      AUTOSAVE_CHAR_THRESHOLD,
    );
  });

  test("retries three times with bounded exponential backoff", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const result = await saveWithRetry(
      async () => {
        attempts += 1;

        if (attempts < 4) {
          throw new Error("offline");
        }

        return "saved";
      },
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result).toBe("saved");
    expect(attempts).toBe(4);
    expect(waits).toEqual([400, 800, 1_600]);
  });

  test("surfaces the final error after retries are exhausted", async () => {
    let attempts = 0;

    await expect(saveWithRetry(
      async () => {
        attempts += 1;
        throw new Error("still offline");
      },
      async () => undefined,
    )).rejects.toThrow("still offline");
    expect(attempts).toBe(4);
  });
});
