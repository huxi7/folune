/**
 * [INPUT]: 依赖 Bun mock/test、可控 memo API Promise、MemoTreeNode fixture 与 memoTreeStore
 * [OUTPUT]: 验证可并发创建、临时/真实 ID 替换、草稿保存、精确回滚、移动即时更新，以及 AI 工具调用投影/失败回滚/命令对账
 * [POS]: app/src/shared/store 的乐观事务回归测试，专门保护 UI 不等待接口、连续创建互不阻塞与并发编辑不丢字三条核心不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  CreateMemoFolderInput,
  CreateMemoInput,
  MemoDetailNode,
  MemoTreeNode,
  MoveMemoNodeInput,
  UpdateMemoInput,
  UpdateMemoNodeInput,
} from "../api/memo";

const TIME = "2026-08-08T00:00:00.000Z";

const makeNode = (
  id: string,
  type: "folder" | "memo",
  parentId: string | null,
  sortOrder: string,
  content = "正文",
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: type === "memo"
    ? {
        created_at: TIME,
        excerpt: content,
        metadata: {},
        node_id: id,
        updated_at: TIME,
        user_id: "user-1",
        word_count: content.length,
      }
    : null,
  metadata: {},
  node_type: type,
  parent_id: parentId,
  revision: 1,
  sort_order: sortOrder,
  title: id,
  updated_at: TIME,
  user_id: "user-1",
});

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const makeDetail = (
  id: string,
  parentId: string | null,
  sortOrder: string,
  content = "正文",
): MemoDetailNode => {
  const { children: _children, memo, ...node } = makeNode(
    id,
    "memo",
    parentId,
    sortOrder,
    content,
  );
  return {
    ...node,
    children: [],
    memo: { ...memo!, content_mdx: content },
  };
};

let createFolderHandler: (
  token: string,
  input: CreateMemoFolderInput,
) => Promise<MemoTreeNode>;
let createMemoHandler: (
  token: string,
  input: CreateMemoInput,
) => Promise<MemoDetailNode>;
let moveHandler: (
  token: string,
  nodeId: string,
  input: MoveMemoNodeInput,
) => Promise<MemoTreeNode>;
let updateMemoHandler: (
  token: string,
  nodeId: string,
  input: UpdateMemoInput,
) => Promise<MemoDetailNode>;
let updateNodeHandler: (
  token: string,
  nodeId: string,
  input: UpdateMemoNodeInput,
) => Promise<MemoTreeNode>;
let softDeleteHandler: (
  token: string,
  nodeId: string,
) => Promise<{ id: string; deleted_at: string }>;
let restoreHandler: (
  token: string,
  nodeId: string,
) => Promise<MemoTreeNode>;
let getTreeCallCount = 0;
let updatedMemoNodeIds: string[] = [];

mock.module("../api/memo", () => ({
  createMemo: (...args: [string, CreateMemoInput]) => createMemoHandler(...args),
  createMemoFolder: (...args: [string, CreateMemoFolderInput]) =>
    createFolderHandler(...args),
  getMemoTree: async () => {
    getTreeCallCount += 1;
    return [];
  },
  getMemo: async (_token: string, nodeId: string) =>
    makeDetail(nodeId, null, "1000"),
  moveMemoNode: (...args: [string, string, MoveMemoNodeInput]) =>
    moveHandler(...args),
  restoreMemoNode: (...args: [string, string]) => restoreHandler(...args),
  softDeleteMemoNode: (...args: [string, string]) =>
    softDeleteHandler(...args),
  updateMemo: (...args: [string, string, UpdateMemoInput]) =>
    updateMemoHandler(...args),
  updateMemoNode: (...args: [string, string, UpdateMemoNodeInput]) =>
    updateNodeHandler(...args),
}));

const { useMemoTreeStore } = await import("./memoTreeStore");
const { useMemoDocumentStore } = await import("./memoDocumentStore");

const primeDocument = (id: string, content: string, title = id) => {
  useMemoDocumentStore.getState().primeMemo({
    ...makeDetail(id, null, "1000", content),
    title,
  });
};

beforeEach(() => {
  useMemoTreeStore.getState().reset();
  getTreeCallCount = 0;
  updatedMemoNodeIds = [];
  createFolderHandler = async (_token, input) =>
    makeNode("folder-real", "folder", input.parent_id, "1000");
  createMemoHandler = async (_token, input) =>
    makeDetail("memo-real", input.parent_id, input.sort_order ?? "1000", input.content_mdx ?? "正文");
  moveHandler = async (_token, nodeId, input) =>
    makeNode(nodeId, "memo", input.parent_id, input.sort_order);
  updateMemoHandler = async (_token, nodeId, input) => {
    updatedMemoNodeIds.push(nodeId);
    return makeDetail(
      nodeId,
      null,
      "1000",
      input.content_mdx ?? "正文",
    );
  };
  updateNodeHandler = async (_token, nodeId, input) => ({
    ...makeNode(nodeId, "memo", null, "1000"),
    title: input.title,
  });
  softDeleteHandler = async (_token, nodeId) => ({
    id: nodeId,
    deleted_at: TIME,
  });
  restoreHandler = async (_token, nodeId) =>
    makeNode(nodeId, "memo", null, "1000");
});

describe("memoTreeStore optimistic transactions", () => {
  test("hydrates the route bootstrap without starting a second tree request", () => {
    const bootstrap = [makeNode("bootstrap-memo", "memo", null, "2000")];

    useMemoTreeStore.getState().hydrateTree(bootstrap);

    expect(useMemoTreeStore.getState().nodes.map((node) => node.id)).toEqual([
      "bootstrap-memo",
    ]);
    expect(getTreeCallCount).toBe(0);
  });

  test("returns optimistic memos synchronously and allows concurrent creates", async () => {
    const firstRequest = deferred<MemoDetailNode>();
    const secondRequest = deferred<MemoDetailNode>();
    let requestCount = 0;
    createMemoHandler = () => {
      requestCount += 1;
      return requestCount === 1 ? firstRequest.promise : secondRequest.promise;
    };

    const first = useMemoTreeStore.getState().beginCreateMemo("token", {
      parent_id: null,
      sort_order: "1000",
      title: "第一篇",
    });
    const second = useMemoTreeStore.getState().beginCreateMemo("token", {
      parent_id: null,
      sort_order: "500",
      title: "第二篇",
    });

    expect(first.optimistic.id).toStartWith("optimistic-memo-");
    expect(second.optimistic.id).toStartWith("optimistic-memo-");
    expect(second.optimistic.id).not.toBe(first.optimistic.id);
    expect(useMemoTreeStore.getState().nodes).toHaveLength(2);
    expect(requestCount).toBe(2);

    secondRequest.resolve(makeDetail("memo-real-2", null, "500"));
    firstRequest.resolve(makeDetail("memo-real-1", null, "1000"));
    await Promise.all([first.committed, second.committed]);
    expect(useMemoTreeStore.getState().nodes.map((node) => node.id)).toEqual([
      "memo-real-2",
      "memo-real-1",
    ]);
  });

  test("preserves local title and content when the temporary id commits", async () => {
    const request = deferred<MemoDetailNode>();
    createMemoHandler = () => request.promise;
    const creation = useMemoTreeStore.getState().beginCreateMemo("token", {
      content_mdx: "",
      parent_id: null,
      sort_order: "1000",
      title: "未命名备忘录",
    });
    const optimisticId = creation.optimistic.id;

    useMemoTreeStore.getState().updateMemoTitleLocal(optimisticId, "本地标题");
    useMemoTreeStore.getState().updateMemoContentLocal(optimisticId, "正在输入");
    request.resolve({
      ...makeDetail("memo-real", null, "1000", ""),
      title: "未命名备忘录",
    });
    await creation.committed;

    const committed = useMemoTreeStore.getState().nodes[0];
    expect(committed?.id).toBe("memo-real");
    expect(committed?.title).toBe("本地标题");
    expect(useMemoDocumentStore.getState().documents["memo-real"]?.memo.content_mdx).toBe("正在输入");
    expect(useMemoTreeStore.getState().resolveMemoId(optimisticId)).toBe(
      "memo-real",
    );
    expect(useMemoTreeStore.getState().getMemoClientKey("memo-real")).toBe(
      optimisticId,
    );
  });

  test("waits for creation before saving an optimistic memo to its real id", async () => {
    const request = deferred<MemoDetailNode>();
    createMemoHandler = () => request.promise;
    const creation = useMemoTreeStore.getState().beginCreateMemo("token", {
      content_mdx: "",
      parent_id: null,
      title: "未命名备忘录",
    });
    const optimisticId = creation.optimistic.id;
    useMemoTreeStore.getState().updateMemoContentLocal(optimisticId, "立即输入");
    const saving = useMemoTreeStore.getState().saveMemoDraft(
      "token",
      optimisticId,
      { content_mdx: "立即输入" },
    );

    expect(updatedMemoNodeIds).toEqual([]);
    request.resolve(makeDetail("memo-real", null, "1000", ""));
    await creation.committed;
    await saving;
    expect(updatedMemoNodeIds).toEqual(["memo-real"]);
    expect(useMemoDocumentStore.getState().documents["memo-real"]?.memo.content_mdx).toBe(
      "立即输入",
    );
  });

  test("rolls back only the failed concurrent creation", async () => {
    const firstRequest = deferred<MemoDetailNode>();
    const secondRequest = deferred<MemoDetailNode>();
    let requestCount = 0;
    createMemoHandler = () => {
      requestCount += 1;
      return requestCount === 1 ? firstRequest.promise : secondRequest.promise;
    };
    const first = useMemoTreeStore.getState().beginCreateMemo("token", {
      parent_id: null,
      title: "失败项",
    });
    const second = useMemoTreeStore.getState().beginCreateMemo("token", {
      parent_id: null,
      title: "成功项",
    });

    firstRequest.reject(new Error("create failed"));
    secondRequest.resolve(makeDetail("memo-real", null, "1000"));
    await expect(first.committed).rejects.toThrow("create failed");
    await second.committed;
    expect(useMemoTreeStore.getState().nodes.map((node) => node.id)).toEqual([
      "memo-real",
    ]);
  });

  test("inserts an optimistic folder and replaces it with the server node", async () => {
    const request = deferred<MemoTreeNode>();
    createFolderHandler = () => request.promise;
    const creation = useMemoTreeStore.getState().createFolder("token", {
      parent_id: null,
      title: "临时文件夹",
    });

    expect(useMemoTreeStore.getState().nodes[0]?.id).toStartWith(
      "optimistic-folder-",
    );
    request.resolve(makeNode("folder-real", "folder", null, "1000"));
    await creation;
    expect(useMemoTreeStore.getState().nodes[0]?.id).toBe("folder-real");
  });

  test("rolls create failure back to the previous tree", async () => {
    const previous = [makeNode("existing", "memo", null, "1000")];
    useMemoTreeStore.setState({ nodes: previous });
    createMemoHandler = async () => {
      throw new Error("create failed");
    };
    const creation = useMemoTreeStore.getState().createMemo("token", {
      parent_id: null,
      title: "临时备忘录",
    });

    expect(useMemoTreeStore.getState().nodes.length).toBe(2);
    await expect(creation).rejects.toThrow("create failed");
    expect(useMemoTreeStore.getState().nodes).toEqual(previous);
  });

  test("moves immediately and restores the previous tree on API failure", async () => {
    const previous = [
      makeNode("folder", "folder", null, "1000"),
      makeNode("memo", "memo", null, "2000"),
    ];
    const request = deferred<MemoTreeNode>();
    useMemoTreeStore.setState({ nodes: previous });
    moveHandler = () => request.promise;
    const movement = useMemoTreeStore.getState().moveNode(
      "token",
      "memo",
      { parent_id: "folder", sort_order: "1000" },
    );

    expect(
      useMemoTreeStore.getState().nodes[0]?.children[0]?.id,
    ).toBe("memo");
    request.reject(new Error("move failed"));
    await expect(movement).rejects.toThrow("move failed");
    expect(useMemoTreeStore.getState().nodes).toEqual(previous);
  });

  test("keeps a newer move when an older queued request fails", async () => {
    const firstRequest = deferred<MemoTreeNode>();
    const secondRequest = deferred<MemoTreeNode>();
    let requestCount = 0;
    useMemoTreeStore.setState({
      nodes: [
        makeNode("folder-a", "folder", null, "1000"),
        makeNode("folder-b", "folder", null, "2000"),
        makeNode("memo", "memo", null, "3000"),
      ],
    });
    moveHandler = () => {
      requestCount += 1;
      return requestCount === 1 ? firstRequest.promise : secondRequest.promise;
    };

    const firstMove = useMemoTreeStore.getState().moveNode(
      "token",
      "memo",
      { parent_id: "folder-a", sort_order: "1000" },
    );
    const secondMove = useMemoTreeStore.getState().moveNode(
      "token",
      "memo",
      { parent_id: "folder-b", sort_order: "1000" },
    );

    expect(
      useMemoTreeStore.getState().nodes[1]?.children[0]?.id,
    ).toBe("memo");
    firstRequest.reject(new Error("older move failed"));
    await expect(firstMove).rejects.toThrow("older move failed");
    await Promise.resolve();
    secondRequest.resolve(makeNode("memo", "memo", "folder-b", "1000"));
    await secondMove;
    expect(
      useMemoTreeStore.getState().nodes[1]?.children[0]?.id,
    ).toBe("memo");
  });

  test("does not let an old save response overwrite newer local input", async () => {
    const request = deferred<MemoDetailNode>();
    useMemoTreeStore.setState({
      nodes: [makeNode("memo", "memo", null, "1000", "准备保存")],
    });
    primeDocument("memo", "准备保存");
    updateMemoHandler = () => request.promise;
    const saving = useMemoTreeStore.getState().saveMemoContent(
      "token",
      "memo",
      "准备保存",
    );
    useMemoTreeStore.getState().updateMemoContentLocal("memo", "继续输入的新内容");
    request.resolve(makeDetail("memo", null, "1000", "准备保存"));
    await saving;

    expect(
      useMemoDocumentStore.getState().documents["memo"]?.memo.content_mdx,
    ).toBe("继续输入的新内容");
  });

  test("saves title and content together while merging only current fields", async () => {
    const request = deferred<MemoDetailNode>();
    useMemoTreeStore.setState({
      nodes: [{
        ...makeNode("memo", "memo", null, "1000", "准备保存"),
        title: "旧标题",
      }],
    });
    primeDocument("memo", "准备保存", "旧标题");
    updateMemoHandler = () => request.promise;
    const saving = useMemoTreeStore.getState().saveMemoDraft(
      "token",
      "memo",
      { content_mdx: "准备保存", title: "新标题" },
    );

    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("新标题");
    useMemoTreeStore.getState().updateMemoContentLocal("memo", "继续输入");
    request.resolve({
      ...makeDetail("memo", null, "1000", "准备保存"),
      title: "新标题",
    });
    await saving;

    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("新标题");
    expect(
      useMemoDocumentStore.getState().documents["memo"]?.memo.content_mdx,
    ).toBe("继续输入");
  });

  test("keeps local content and rolls back only the optimistic title on failure", async () => {
    useMemoTreeStore.setState({
      nodes: [{
        ...makeNode("memo", "memo", null, "1000", "本地正文"),
        title: "旧标题",
      }],
    });
    primeDocument("memo", "本地正文", "旧标题");
    updateMemoHandler = async () => {
      throw new Error("offline");
    };

    await expect(useMemoTreeStore.getState().saveMemoDraft(
      "token",
      "memo",
      { content_mdx: "本地正文", title: "新标题" },
    )).rejects.toThrow("offline");
    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("旧标题");
    expect(
      useMemoDocumentStore.getState().documents["memo"]?.memo.content_mdx,
    ).toBe("本地正文");
  });

  test("optimistically removes a subtree and restores the exact snapshot on failure", async () => {
    const previous = [
      makeNode("folder", "folder", null, "1000", "", [
        makeNode("memo", "memo", "folder", "1000", "未丢失正文"),
      ]),
      makeNode("other", "memo", null, "2000"),
    ];
    const request = deferred<{ id: string; deleted_at: string }>();
    useMemoTreeStore.setState({ nodes: previous });
    softDeleteHandler = () => request.promise;
    const deletion = useMemoTreeStore.getState().softDeleteNode(
      "token",
      "folder",
    );

    expect(useMemoTreeStore.getState().nodes.map((node) => node.id)).toEqual([
      "other",
    ]);
    request.reject(new Error("delete failed"));
    await expect(deletion).rejects.toThrow("delete failed");
    expect(useMemoTreeStore.getState().nodes).toEqual(previous);
  });

  test("merges a restored subtree into its original parent without refetching", async () => {
    const restored = makeNode("restored", "folder", "parent", "500", "", [
      makeNode("child", "memo", "restored", "1000", "正文仍在"),
    ]);
    useMemoTreeStore.setState({
      nodes: [makeNode("parent", "folder", null, "1000")],
    });
    restoreHandler = async () => restored;

    await useMemoTreeStore.getState().restoreNode("token", "restored");

    expect(
      useMemoTreeStore.getState().nodes[0]?.children[0]?.children[0]?.id,
    ).toBe("child");
    expect(getTreeCallCount).toBe(0);
  });

  test("projects one AI rename once and rolls it back on tool failure", () => {
    useMemoTreeStore.setState({
      nodes: [{ ...makeNode("memo", "memo", null, "1000"), title: "旧标题" }],
    });
    const store = useMemoTreeStore.getState();
    store.projectAiToolCall("tool-rename", "rename_node", {
      node_id: "memo",
      expected_revision: 1,
      title: "AI 新标题",
    });
    store.projectAiToolCall("tool-rename", "rename_node", {
      node_id: "memo",
      expected_revision: 1,
      title: "重复投影",
    });
    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("AI 新标题");
    store.rollbackAiToolCall("tool-rename");
    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("旧标题");
  });

  test("replaces optimistic AI create with the authoritative command node", () => {
    useMemoTreeStore.setState({ nodes: [] });
    const store = useMemoTreeStore.getState();
    store.projectAiToolCall("tool-create", "create_node", {
      node_type: "memo",
      parent_id: null,
      title: "AI 新笔记",
      content_mdx: "新正文",
    });
    expect(useMemoTreeStore.getState().nodes[0]?.id).toStartWith("optimistic-memo-");
    const serverNode = {
      ...makeNode("server-memo", "memo", null, "1000", "新正文"),
      title: "AI 新笔记",
    };
    store.reconcileAiCommand({
      id: "command-create",
      thread_id: null,
      tool_call_id: "tool-create",
      operation: "create_node",
      target_node_id: "server-memo",
      expected_revision: null,
      idempotency_key: "create-once",
      input: {},
      before_state: null,
      after_state: { node: serverNode, content: serverNode.memo },
      undo_result: null,
      status: "succeeded",
      approval_source: "approval_agent",
      risk: "low",
      approval_reason: "明确",
      error_code: null,
      updated_at: TIME,
      applied_at: TIME,
      undone_at: null,
    });
    expect(useMemoTreeStore.getState().nodes.map((item) => item.id)).toEqual(["server-memo"]);
  });

  test("rolls back an optimistic AI rename when command result is stale", () => {
    useMemoTreeStore.setState({
      nodes: [{ ...makeNode("memo-stale", "memo", null, "1000"), title: "旧标题" }],
    });
    const store = useMemoTreeStore.getState();
    store.projectAiToolCall("tool-stale", "rename_node", {
      node_id: "memo-stale",
      expected_revision: 1,
      title: "模型标题",
    });
    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("模型标题");

    store.reconcileAiCommand({
      id: "command-stale",
      thread_id: null,
      tool_call_id: "tool-stale",
      operation: "rename_node",
      target_node_id: "memo-stale",
      expected_revision: 1,
      idempotency_key: "stale-once",
      input: {},
      before_state: null,
      after_state: null,
      undo_result: null,
      status: "stale",
      approval_source: "approval_agent",
      risk: "low",
      approval_reason: "明确",
      error_code: "AI_REVISION_CONFLICT",
      updated_at: TIME,
      applied_at: null,
      undone_at: null,
    });

    expect(useMemoTreeStore.getState().nodes[0]?.title).toBe("旧标题");
  });
});
