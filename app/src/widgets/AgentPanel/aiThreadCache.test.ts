/**
 * [INPUT]: 依赖 Bun test 与 aiThreadCache 的可控时钟 API
 * [OUTPUT]: 验证 AI 会话快照按用户隔离、允许陈旧读取并可局部更新
 * [POS]: AgentPanel 缓存回归测试，保护“立即显示旧内容、后台校准”的体验边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, test } from "bun:test";

import type { AiThreadDetail } from "../../shared/api/ai";
import {
  AI_THREAD_CACHE_FRESH_MS,
  patchAiThreadSnapshot,
  readAiThreadSnapshot,
  resetAiThreadSnapshotsForTests,
  writeAiThreadSnapshot,
} from "./aiThreadCache";

const detail = { id: "thread-a", title: "A" } as AiThreadDetail;

afterEach(resetAiThreadSnapshotsForTests);

describe("aiThreadCache", () => {
  test("命中时立即返回，并在 TTL 后保留为可用陈旧快照", () => {
    writeAiThreadSnapshot("user-a", { messages: [], selectedThread: detail, threads: [detail] }, 100);
    expect(readAiThreadSnapshot("user-a", 101)?.fresh).toBe(true);
    expect(readAiThreadSnapshot("user-a", 100 + AI_THREAD_CACHE_FRESH_MS)?.fresh).toBe(false);
    expect(readAiThreadSnapshot("user-b", 101)).toBeNull();
  });

  test("局部刷新不清空其余可见内容", () => {
    writeAiThreadSnapshot("user-a", { messages: [], selectedThread: detail, threads: [detail] }, 100);
    patchAiThreadSnapshot("user-a", { messages: [{ id: "message-a" } as never] }, 200);
    const cached = readAiThreadSnapshot("user-a", 200)?.snapshot;
    expect(cached?.messages).toHaveLength(1);
    expect(cached?.selectedThread.id).toBe("thread-a");
  });
});
