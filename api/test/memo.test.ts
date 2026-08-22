/**
 * [INPUT]: 依赖 Bun test、Hono app、Web fetch、内存 Supabase Auth/PostgREST mock 与 memo 领域模型
 * [OUTPUT]: 覆盖 memo API 的认证、轻量树/关键词搜索、单篇正文、创建补偿、正文统计、owner 隔离、严格更新与防环移动
 * [POS]: api/test 的备忘录树 HTTP 全链路契约测试，不连接远端服务且不保存或输出真实凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type {
  CreateMemoContentData,
  CreateMemoNodeData,
  MemoContent,
  MemoNode,
} from "../src/model/memo.model.ts";

const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "profile-test-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-05T14:00:00.000Z";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

const { app } = await import("../src/app.ts");

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const nodeFixture = (
  id: string,
  overrides: Partial<MemoNode> = {},
): MemoNode => ({
  id,
  user_id: USER_ID,
  parent_id: null,
  node_type: "folder",
  title: "Folder",
  sort_order: 1000,
  icon: null,
  color: null,
  metadata: {},
  revision: 1,
  deleted_at: null,
  deleted_root_id: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const contentFixture = (
  nodeId: string,
  overrides: Partial<MemoContent> = {},
): MemoContent => ({
  node_id: nodeId,
  user_id: USER_ID,
  content_mdx: "",
  excerpt: null,
  word_count: 0,
  metadata: {},
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

type MockOptions = {
  invalidToken?: boolean;
  rejectContentCreate?: boolean;
};

class MockSupabase {
  readonly nodes = new Map<string, MemoNode>();
  readonly contents = new Map<string, MemoContent>();
  readonly operations: string[] = [];
  readonly requestedUrls: string[] = [];
  readonly nodePatchBodies: Array<Record<string, unknown>> = [];
  headersMatched = true;
  userFiltersMatched = true;
  private idCounter = 10;
  private readonly invalidToken: boolean;
  private readonly rejectContentCreate: boolean;

  constructor(options: MockOptions = {}) {
    this.invalidToken = options.invalidToken ?? false;
    this.rejectContentCreate = options.rejectContentCreate ?? false;
  }

  readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    this.requestedUrls.push(url.toString());
    this.headersMatched &&=
      request.headers.get("apikey") === PUBLISHABLE_KEY &&
      request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`;

    if (url.pathname === "/auth/v1/user") {
      this.operations.push("auth:get");
      return this.invalidToken
        ? jsonResponse({ message: "Invalid token" }, 401)
        : jsonResponse({
            id: USER_ID,
            email: "memo-test@example.com",
          });
    }

    if (url.pathname === "/rest/v1/memo_nodes") {
      return this.handleNodes(request, url);
    }

    if (url.pathname === "/rest/v1/memos") {
      return this.handleContents(request, url);
    }

    throw new Error(`Unexpected path: ${url.pathname}`);
  };

  private assertUserFilter(url: URL): string {
    const filter = url.searchParams.get("user_id");
    const userId = filter?.startsWith("eq.")
      ? filter.slice(3)
      : "";
    this.userFiltersMatched &&= userId === USER_ID;
    return userId;
  }

  private async handleNodes(
    request: Request,
    url: URL,
  ): Promise<Response> {
    if (request.method === "GET") {
      this.operations.push("nodes:get");
      const userId = this.assertUserFilter(url);
      const idFilter = url.searchParams.get("id");
      const parentFilter = url.searchParams.get("parent_id");
      let rows = Array.from(this.nodes.values()).filter(
        (node) => node.user_id === userId && node.deleted_at === null,
      );

      if (idFilter?.startsWith("eq.")) {
        rows = rows.filter((node) => node.id === idFilter.slice(3));
      }

      if (parentFilter === "is.null") {
        rows = rows.filter((node) => node.parent_id === null);
      } else if (parentFilter?.startsWith("eq.")) {
        rows = rows.filter(
          (node) => node.parent_id === parentFilter.slice(3),
        );
      }

      rows.sort(
        (left, right) =>
          left.sort_order - right.sort_order ||
          left.id.localeCompare(right.id),
      );

      if (url.searchParams.get("order")?.startsWith("sort_order.desc")) {
        rows.reverse();
      }

      const limit = Number(url.searchParams.get("limit") ?? rows.length);
      const limited = rows.slice(0, limit);

      return jsonResponse(
        url.searchParams.get("select") === "sort_order"
          ? limited.map(({ sort_order }) => ({ sort_order }))
          : limited,
      );
    }

    if (request.method === "POST") {
      this.operations.push("nodes:post");
      const input = (await request.json()) as CreateMemoNodeData;
      const id = `00000000-0000-4000-8000-${String(
        this.idCounter++,
      ).padStart(12, "0")}`;
      const node = nodeFixture(id, input);
      this.nodes.set(id, node);
      return jsonResponse([node], 201);
    }

    if (request.method === "PATCH") {
      this.operations.push("nodes:patch");
      const userId = this.assertUserFilter(url);
      const id = url.searchParams.get("id")?.slice(3) ?? "";
      const existing = this.nodes.get(id);
      const input = (await request.json()) as Record<string, unknown>;
      this.nodePatchBodies.push(input);

      if (existing === undefined || existing.user_id !== userId) {
        return jsonResponse([]);
      }

      const updated = {
        ...existing,
        ...input,
        updated_at: NOW,
      } as MemoNode;
      this.nodes.set(id, updated);
      return jsonResponse([updated]);
    }

    if (request.method === "DELETE") {
      this.operations.push("nodes:delete");
      const userId = this.assertUserFilter(url);
      const id = url.searchParams.get("id")?.slice(3) ?? "";
      const existing = this.nodes.get(id);

      if (existing === undefined || existing.user_id !== userId) {
        return jsonResponse([]);
      }

      this.nodes.delete(id);
      this.contents.delete(id);
      return jsonResponse([existing]);
    }

    throw new Error(`Unexpected memo_nodes method: ${request.method}`);
  }

  private async handleContents(
    request: Request,
    url: URL,
  ): Promise<Response> {
    if (request.method === "GET") {
      this.operations.push("memos:get");
      const userId = this.assertUserFilter(url);
      const nodeFilter = url.searchParams.get("node_id");
      let rows = Array.from(this.contents.values()).filter(
        (content) => content.user_id === userId,
      );

      if (nodeFilter?.startsWith("eq.")) {
        rows = rows.filter(
          (content) => content.node_id === nodeFilter.slice(3),
        );
      }

      const contentFilter = url.searchParams.get("content_mdx");
      if (contentFilter?.startsWith("ilike.*") && contentFilter.endsWith("*")) {
        const keyword = contentFilter.slice(7, -1).replaceAll("\\", "").toLocaleLowerCase();
        rows = rows.filter((content) =>
          content.content_mdx.toLocaleLowerCase().includes(keyword));
      }

      const limit = Number(url.searchParams.get("limit") ?? rows.length);
      rows = rows.slice(0, limit);

      return jsonResponse(rows);
    }

    if (request.method === "POST") {
      this.operations.push("memos:post");

      if (this.rejectContentCreate) {
        return jsonResponse({ message: "Content insert failed" }, 500);
      }

      const input = (await request.json()) as CreateMemoContentData;
      const content = contentFixture(input.node_id, input);
      this.contents.set(input.node_id, content);
      return jsonResponse([content], 201);
    }

    if (request.method === "PATCH") {
      this.operations.push("memos:patch");
      const userId = this.assertUserFilter(url);
      const nodeId = url.searchParams.get("node_id")?.slice(3) ?? "";
      const existing = this.contents.get(nodeId);
      const input = (await request.json()) as Partial<MemoContent>;

      if (existing === undefined || existing.user_id !== userId) {
        return jsonResponse([]);
      }

      const updated = { ...existing, ...input, updated_at: NOW };
      this.contents.set(nodeId, updated);
      return jsonResponse([updated]);
    }

    throw new Error(`Unexpected memos method: ${request.method}`);
  }
}

const originalFetch = globalThis.fetch;
let mock: MockSupabase;

beforeEach(() => {
  mock = new MockSupabase();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const authenticatedRequest = (
  path: string,
  init: RequestInit = {},
): Request =>
  new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });

describe("memo API authentication", () => {
  test("memo 与回收站接口没有 Bearer token 均返回统一 401", async () => {
    const nodeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const requests = [
      app.request("/memo-tree"),
      app.request("/memo-search?q=test"),
      app.request("/memo-folders", { method: "POST" }),
      app.request("/memos", { method: "POST" }),
      app.request(`/memos/${nodeId}`),
      app.request(`/memos/${nodeId}`, { method: "PATCH" }),
      app.request(`/memo-nodes/${nodeId}`, { method: "PATCH" }),
      app.request(`/memo-nodes/${nodeId}/move`, { method: "PATCH" }),
      app.request("/memo-trash"),
      app.request("/memo-trash", { method: "DELETE" }),
      app.request(`/memo-nodes/${nodeId}/trash`, { method: "POST" }),
      app.request(`/memo-nodes/${nodeId}/restore`, { method: "POST" }),
      app.request(`/memo-nodes/${nodeId}`, { method: "DELETE" }),
    ];

    for (const response of await Promise.all(requests)) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        code: "UNAUTHORIZED",
        message: "Authorization Bearer token is required",
        data: null,
      });
    }

    expect(mock.operations).toEqual([]);
  });

  test("无效或过期 token 返回统一 401", async () => {
    mock = new MockSupabase({ invalidToken: true });
    globalThis.fetch = mock.fetch as typeof fetch;
    const response = await app.fetch(
      authenticatedRequest("/memo-tree"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mock.operations).toEqual(["auth:get"]);
  });
});

describe("GET /memo-tree", () => {
  test("一次读取并按排序组装不含正文的 folder/memo 树", async () => {
    const folderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const childMemoId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const rootMemoId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mock.nodes.set(folderId, nodeFixture(folderId));
    mock.nodes.set(
      childMemoId,
      nodeFixture(childMemoId, {
        parent_id: folderId,
        node_type: "memo",
        title: "Child memo",
      }),
    );
    mock.nodes.set(
      rootMemoId,
      nodeFixture(rootMemoId, {
        node_type: "memo",
        title: "Root memo",
        sort_order: 500,
      }),
    );
    mock.contents.set(childMemoId, contentFixture(childMemoId));
    mock.contents.set(rootMemoId, contentFixture(rootMemoId));

    const response = await app.fetch(
      authenticatedRequest("/memo-tree"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.map((node: MemoNode) => node.id)).toEqual([
      rootMemoId,
      folderId,
    ]);
    expect(payload.data[1].children[0].id).toBe(childMemoId);
    expect(payload.data[1].children[0].memo.node_id).toBe(childMemoId);
    expect(JSON.stringify(payload.data)).not.toContain("content_mdx");
    expect(mock.requestedUrls.find((url) => url.includes("/rest/v1/memos")))
      .not.toContain("node_id=in.");
    expect(mock.operations).toEqual([
      "auth:get",
      "nodes:get",
      "memos:get",
    ]);
    expect(mock.headersMatched).toBe(true);
    expect(mock.userFiltersMatched).toBe(true);
  });
});

describe("GET /memo-search", () => {
  test("只返回当前用户正文命中的 ID 与摘要，不返回完整正文", async () => {
    const matchingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mock.contents.set(matchingId, contentFixture(matchingId, {
      content_mdx: "项目里讨论了商业模式",
      excerpt: "项目里讨论了商业模式",
    }));
    mock.contents.set(otherId, contentFixture(otherId, {
      content_mdx: "完全无关",
      excerpt: "完全无关",
    }));

    const response = await app.fetch(authenticatedRequest(
      "/memo-search?q=%E5%95%86%E4%B8%9A%E6%A8%A1%E5%BC%8F&limit=10",
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{
      excerpt: "项目里讨论了商业模式",
      node_id: matchingId,
    }]);
    expect(JSON.stringify(payload.data)).not.toContain("content_mdx");
    expect(mock.userFiltersMatched).toBe(true);
  });
});

describe("POST /memo-folders and POST /memos", () => {
  test("创建可无限嵌套的 folder 并追加到同级末尾", async () => {
    const parentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const siblingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mock.nodes.set(parentId, nodeFixture(parentId));
    mock.nodes.set(
      siblingId,
      nodeFixture(siblingId, {
        parent_id: parentId,
        sort_order: 2500,
      }),
    );

    const response = await app.fetch(
      authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ title: "Nested", parent_id: parentId }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      user_id: USER_ID,
      parent_id: parentId,
      node_type: "folder",
      title: "Nested",
      sort_order: 3500,
      children: [],
      memo: null,
    });
  });

  test("新用户可创建根目录 memo 并生成摘要与字数", async () => {
    const response = await app.fetch(
      authenticatedRequest("/memos", {
        method: "POST",
        body: JSON.stringify({
          title: "First memo",
          content_mdx: "# 你好 world",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      user_id: USER_ID,
      parent_id: null,
      node_type: "memo",
      title: "First memo",
      sort_order: 1000,
      children: [],
      memo: {
        content_mdx: "# 你好 world",
        excerpt: "你好 world",
        word_count: 3,
      },
    });
    expect(mock.operations).toContain("nodes:post");
    expect(mock.operations).toContain("memos:post");
  });

  test("调用方 sort_order 被原样使用以支持顶部插入", async () => {
    const response = await app.fetch(
      authenticatedRequest("/memos", {
        method: "POST",
        body: JSON.stringify({ title: "Pinned", sort_order: -25.5 }),
      }),
    );
    const payload = await response.json();

    expect(payload.data.sort_order).toBe(-25.5);
    expect(mock.operations.filter((value) => value === "nodes:get")).toEqual([]);
  });

  test("memo 不能作为父节点且不会执行创建", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo" }),
    );
    mock.contents.set(memoId, contentFixture(memoId));

    const response = await app.fetch(
      authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ title: "Invalid", parent_id: memoId }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("MEMO_PARENT_NOT_FOLDER");
    expect(mock.operations).not.toContain("nodes:post");
  });

  test("正文创建失败时补偿删除已创建节点", async () => {
    mock = new MockSupabase({ rejectContentCreate: true });
    globalThis.fetch = mock.fetch as typeof fetch;
    const response = await app.fetch(
      authenticatedRequest("/memos", {
        method: "POST",
        body: JSON.stringify({ title: "Compensate" }),
      }),
    );

    expect(response.status).toBe(502);
    expect(mock.nodes.size).toBe(0);
    expect(mock.operations).toContain("nodes:delete");
  });
});

describe("memo read and update", () => {
  test("GET /memos/:nodeId 返回 node 与正文", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo", title: "Memo" }),
    );
    mock.contents.set(
      memoId,
      contentFixture(memoId, { content_mdx: "Body" }),
    );

    const response = await app.fetch(
      authenticatedRequest(`/memos/${memoId}`),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.memo.content_mdx).toBe("Body");
  });

  test("其他用户 nodeId 被 user_id 条件隐藏为 404", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, {
        user_id: OTHER_USER_ID,
        node_type: "memo",
      }),
    );

    const response = await app.fetch(
      authenticatedRequest(`/memos/${memoId}`),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).data).toBeNull();
    expect(mock.userFiltersMatched).toBe(true);
  });

  test("PATCH /memos 同时更新标题、正文、摘要和字数", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo", title: "Old" }),
    );
    mock.contents.set(memoId, contentFixture(memoId));

    const response = await app.fetch(
      authenticatedRequest(`/memos/${memoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "New",
          content_mdx: "Alpha beta 中文",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.title).toBe("New");
    expect(payload.data.memo).toMatchObject({
      content_mdx: "Alpha beta 中文",
      excerpt: "Alpha beta 中文",
      word_count: 4,
    });
  });

  test("PATCH /memos 只更新实际提交字段", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo", title: "Keep" }),
    );
    mock.contents.set(memoId, contentFixture(memoId));

    const response = await app.fetch(
      authenticatedRequest(`/memos/${memoId}`, {
        method: "PATCH",
        body: JSON.stringify({ content_mdx: "Only body" }),
      }),
    );
    const payload = await response.json();

    expect(payload.data.title).toBe("Keep");
    expect(mock.nodePatchBodies).toEqual([]);
  });

  test("PATCH /memos 原样保存空格、缩进、尾随空格与空白行", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const whitespaceContent = "  first  \n\n    second\t \n  ";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo", title: "Whitespace" }),
    );
    mock.contents.set(memoId, contentFixture(memoId));

    const response = await app.fetch(
      authenticatedRequest(`/memos/${memoId}`, {
        method: "PATCH",
        body: JSON.stringify({ content_mdx: whitespaceContent }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.memo.content_mdx).toBe(whitespaceContent);
    expect(payload.data.memo.excerpt).toBe("first second");
    expect(payload.data.memo.word_count).toBe(2);
  });
});

describe("memo node rename and move", () => {
  test("重命名 folder 并严格拒绝 user_id 等越权字段", async () => {
    const folderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mock.nodes.set(folderId, nodeFixture(folderId));
    const invalid = await app.fetch(
      authenticatedRequest(`/memo-nodes/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed", user_id: OTHER_USER_ID }),
      }),
    );

    expect(invalid.status).toBe(400);
    expect(mock.operations).not.toContain("nodes:patch");

    const valid = await app.fetch(
      authenticatedRequest(`/memo-nodes/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed" }),
      }),
    );

    expect(valid.status).toBe(200);
    expect((await valid.json()).data.title).toBe("Renamed");
  });

  test("memo 可跨 folder 移动并采用调用方排序", async () => {
    const memoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const targetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, { node_type: "memo" }),
    );
    mock.nodes.set(targetId, nodeFixture(targetId));
    mock.contents.set(memoId, contentFixture(memoId));

    const response = await app.fetch(
      authenticatedRequest(`/memo-nodes/${memoId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ parent_id: targetId, sort_order: 12.5 }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      parent_id: targetId,
      sort_order: 12.5,
    });
  });

  test("folder 不能移动到自己的后代中", async () => {
    const parentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const childId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mock.nodes.set(parentId, nodeFixture(parentId));
    mock.nodes.set(
      childId,
      nodeFixture(childId, { parent_id: parentId }),
    );

    const response = await app.fetch(
      authenticatedRequest(`/memo-nodes/${parentId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ parent_id: childId }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("MEMO_NODE_CYCLE");
    expect(mock.operations).not.toContain("nodes:patch");
  });
});
