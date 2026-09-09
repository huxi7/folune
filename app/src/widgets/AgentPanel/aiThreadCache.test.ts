/**
 * [INPUT]: 依赖 Bun test 与 aiThreadCache 的可控时钟 API
 * [OUTPUT]: 验证 AI 面板快照及逐会话内容按用户隔离、允许陈旧读取并可局部更新/删除
 * [POS]: AgentPanel 缓存回归测试，保护“切换立即回显、后台校准”的体验边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, test } from "bun:test";

import type { AiThreadDetail } from "../../shared/api/ai";
import {
  AI_THREAD_CACHE_FRESH_MS,
  patchAiThreadSnapshot,
  readAiThreadContent,
  readAiThreadSnapshot,
  removeAiThreadContent,
  resetAiThreadSnapshotsForTests,
  writeAiThreadContent,
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

  test("逐会话内容可独立命中，主快照写入也会同步记住当前会话", () => {
    const detailB = { id: "thread-b", title: "B" } as AiThreadDetail;
    writeAiThreadSnapshot("user-a", { messages: [], selectedThread: detail, threads: [detail, detailB] }, 100);
    writeAiThreadContent("user-a", {
      messages: [{ id: "message-b" } as never],
      selectedThread: detailB,
    }, 200);

    expect(readAiThreadContent("user-a", "thread-a", 101)?.fresh).toBe(true);
    expect(readAiThreadContent("user-a", "thread-b", 200)?.snapshot.messages[0]?.id)
      .toBe("message-b");
    expect(readAiThreadContent("user-b", "thread-b", 200)).toBeNull();
  });

  test("删除会话只清掉目标内容", () => {
    const detailB = { id: "thread-b", title: "B" } as AiThreadDetail;
    writeAiThreadContent("user-a", { messages: [], selectedThread: detail }, 100);
    writeAiThreadContent("user-a", { messages: [], selectedThread: detailB }, 100);

    removeAiThreadContent("user-a", "thread-a");

    expect(readAiThreadContent("user-a", "thread-a", 100)).toBeNull();
    expect(readAiThreadContent("user-a", "thread-b", 100)?.snapshot.selectedThread.id)
      .toBe("thread-b");
  });

  test("逐会话缓存有上限，优先淘汰最久未写入的内容", () => {
    for (let index = 0; index < 9; index += 1) {
      writeAiThreadContent("user-a", {
        messages: [],
        selectedThread: { id: `thread-${index}`, title: String(index) } as AiThreadDetail,
      }, index);
    }

    expect(readAiThreadContent("user-a", "thread-0", 9)).toBeNull();
    expect(readAiThreadContent("user-a", "thread-8", 9)?.snapshot.selectedThread.id)
      .toBe("thread-8");
  });
});
