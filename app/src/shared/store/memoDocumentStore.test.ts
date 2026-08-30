/**
 * [INPUT]: 依赖 Bun mock/test、可控单篇 memo API Promise 与 memoDocumentStore
 * [OUTPUT]: 验证正文按 ID 缓存、意图预取与点击请求合并、切换隔离、reset 门禁，以及临时 ID 对账语义
 * [POS]: shared/store 的正文生命周期回归测试，保护目录轻载后只读取被打开笔记这一核心边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { MemoDetailNode } from "../api/memo";

const TIME = "2026-08-22T00:00:00.000Z";

const makeDetail = (id: string, content: string): MemoDetailNode => ({
  children: [],
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: {
    content_mdx: content,
    created_at: TIME,
    excerpt: content,
    metadata: {},
    node_id: id,
    updated_at: TIME,
    user_id: "user-1",
    word_count: content.length,
  },
  metadata: {},
  node_type: "memo",
  parent_id: null,
  revision: 1,
  sort_order: "1000",
  title: id,
  updated_at: TIME,
  user_id: "user-1",
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

let getMemoHandler: (nodeId: string) => Promise<MemoDetailNode>;
let getMemoCalls: string[] = [];

mock.module("../api/memo", () => ({
  getMemo: (_token: string, nodeId: string) => {
    getMemoCalls.push(nodeId);
    return getMemoHandler(nodeId);
  },
  updateMemo: () => Promise.reject(new Error("unexpected update")),
}));

const { useMemoDocumentStore } = await import("./memoDocumentStore");

describe("memoDocumentStore", () => {
  beforeEach(() => {
    getMemoCalls = [];
    getMemoHandler = async (nodeId) => makeDetail(nodeId, `正文-${nodeId}`);
    useMemoDocumentStore.getState().reset();
  });

  test("只按打开的 ID 读取正文，并复用已缓存正文", async () => {
    const first = await useMemoDocumentStore.getState().loadMemo("token", "memo-a");
    const cached = await useMemoDocumentStore.getState().loadMemo("token", "memo-a");
    const second = await useMemoDocumentStore.getState().loadMemo("token", "memo-b");

    expect(getMemoCalls).toEqual(["memo-a", "memo-b"]);
    expect(cached).toBe(first);
    expect(second.memo.content_mdx).toBe("正文-memo-b");
  });

  test("预取与随后打开共用同一份在途正文请求", async () => {
    const pending = deferred<MemoDetailNode>();
    getMemoHandler = () => pending.promise;

    const preload = useMemoDocumentStore.getState().preloadMemo("token", "memo-a");
    const opened = useMemoDocumentStore.getState().loadMemo("token", "memo-a");
    pending.resolve(makeDetail("memo-a", "预热正文"));

    expect(await opened).toBe(await preload);
    expect(getMemoCalls).toEqual(["memo-a"]);
    expect(useMemoDocumentStore.getState().statuses["memo-a"]).toBe("ready");
  });

  test("reset 后忽略旧会话尚未完成的正文响应", async () => {
    const pending = deferred<MemoDetailNode>();
    getMemoHandler = () => pending.promise;
    const request = useMemoDocumentStore.getState().loadMemo("token", "memo-a");

    useMemoDocumentStore.getState().reset();
    pending.resolve(makeDetail("memo-a", "旧会话正文"));
    await request;

    expect(useMemoDocumentStore.getState().documents).toEqual({});
    expect(useMemoDocumentStore.getState().statuses).toEqual({});
  });
});

describe("临时 ID 对账", () => {
  const primeOptimistic = (title: string, content: string) => {
    const optimistic = { ...makeDetail("temp-1", content), title };
    useMemoDocumentStore.getState().primeMemo(optimistic);
  };

  test("用户没动过标题：接纳服务端顺位让开后的默认名", () => {
    primeOptimistic("未命名备忘录", "");
    const server = { ...makeDetail("real-1", ""), title: "未命名备忘录 2" };
    const reconciled = useMemoDocumentStore.getState().rekeyMemo(
      "temp-1",
      server,
      "",
      "未命名备忘录",
    );

    expect(reconciled.title).toBe("未命名备忘录 2");
    expect(useMemoDocumentStore.getState().documents["temp-1"]).toBeUndefined();
  });

  test("提交期间用户已经开始命名：本地标题不被服务端覆盖", () => {
    primeOptimistic("熵与妄作", "");
    const server = { ...makeDetail("real-2", ""), title: "未命名备忘录 2" };
    const reconciled = useMemoDocumentStore.getState().rekeyMemo(
      "temp-1",
      server,
      "",
      "未命名备忘录",
    );

    expect(reconciled.title).toBe("熵与妄作");
  });
});
