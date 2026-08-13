/**
 * [INPUT]: 依赖 Bun test、可注入 WorkerLike 与 MemoToolWorkerClient requestId RPC
 * [OUTPUT]: 验证 Worker 正常通信、类型化错误、崩溃清场及重复 requestId 只投递一次
 * [POS]: AgentPanel Worker Client 协议回归测试，不启动浏览器 Worker、不访问 Store 或网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoToolWorkerRequest, MemoToolWorkerResponse } from "./memoTool.worker";
import { MemoToolWorkerClient, type MemoToolWorkerLike } from "./memoToolWorkerClient";

class FakeWorker implements MemoToolWorkerLike {
  readonly requests: MemoToolWorkerRequest[] = [];
  terminated = false;
  private listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  addEventListener(type: "message" | "error", listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  postMessage(message: MemoToolWorkerRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: "message" | "error", payload?: MemoToolWorkerResponse): void {
    const event = type === "message" ? { data: payload } as MessageEvent : new Event("error");
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  }
}

const request = (requestId: string): MemoToolWorkerRequest => ({
  command: "read_tree",
  input: {},
  nodes: [],
  requestId,
});

describe("memo tool Worker client", () => {
  test("correlates a successful response", async () => {
    const worker = new FakeWorker();
    const client = new MemoToolWorkerClient(() => worker);
    const pending = client.request(request("one"));
    worker.emit("message", {
      ok: true,
      plan: { kind: "read_tree", output: { nodes: [], total: 0 } },
      requestId: "one",
    });
    expect(await pending).toEqual({ kind: "read_tree", output: { nodes: [], total: 0 } });
  });

  test("returns a typed planning error", async () => {
    const worker = new FakeWorker();
    const client = new MemoToolWorkerClient(() => worker);
    const pending = client.request(request("bad"));
    worker.emit("message", { error: "节点不存在", ok: false, requestId: "bad" });
    expect(pending).rejects.toThrow("节点不存在");
  });

  test("deduplicates an in-flight request and rejects all on crash", async () => {
    const worker = new FakeWorker();
    const client = new MemoToolWorkerClient(() => worker);
    const first = client.request(request("same"));
    const duplicate = client.request(request("same"));
    expect(first).toBe(duplicate);
    expect(worker.requests).toHaveLength(1);
    worker.emit("error");
    expect(first).rejects.toThrow("Worker 异常退出");
    expect(worker.terminated).toBeTrue();
  });
});
