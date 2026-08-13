/**
 * [INPUT]: 依赖 Bun test 与 threadSelection 纯函数
 * [OUTPUT]: 覆盖按用户 key 隔离、合法已选会话恢复与失效 ID 回退最近会话
 * [POS]: AgentPanel 会话刷新恢复回归测试，不访问 React、网络或真实 localStorage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { AiThread } from "../../shared/api/ai";
import {
  chooseSelectedThreadId,
  selectedThreadStorageKey,
} from "./threadSelection";

const thread = (id: string): AiThread => ({
  id,
  user_id: "user",
  title: id,
  status: "active",
  created_at: "2026-08-13T00:00:00Z",
  updated_at: "2026-08-13T00:00:00Z",
  last_message_at: "2026-08-13T00:00:00Z",
});

describe("thread selection", () => {
  test("按用户隔离偏好 key", () => {
    expect(selectedThreadStorageKey("user-a")).not.toBe(
      selectedThreadStorageKey("user-b"),
    );
  });

  test("恢复合法选择，失效时回退最近会话", () => {
    const threads = [thread("recent"), thread("older")];
    expect(chooseSelectedThreadId(threads, "older")).toBe("older");
    expect(chooseSelectedThreadId(threads, "missing")).toBe("recent");
    expect(chooseSelectedThreadId([], "missing")).toBeNull();
  });
});
