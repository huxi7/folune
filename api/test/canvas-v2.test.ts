/**
 * [INPUT]: 依赖 Bun test、Hono app、实现 Canvas V2 RPC/同级节点查询/标题唯一约束的内存 Supabase HTTP mock 与 service/auth 的身份缓存测试清空口
 * [OUTPUT]: 覆盖默认/空白 Canvas 入口、同级默认名最大编号与并发让号/存储错误边界、strict protocol=2、人工/AI 共用 mutation、自由文字 scale=8 边界、409 恢复事实与可信 expansion context
 * [POS]: api/test 的 Canvas V2 HTTP 纵向契约；数据库原子性由 staging 回滚事务验证，本文件锁定 router→service→repository 的唯一 RPC 路径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "canvas-v2-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const MEMO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANVAS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NODE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MUTATION_ID = "12121212-1212-4121-8121-121212121212";
const REUSE_ID = "13131313-1313-4131-8131-131313131313";
const REQUEST_ID = "14141414-1414-4141-8141-141414141414";
const NOW = "2026-08-26T12:00:00.000Z";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

const { app } = await import("../src/app.ts");
const { authService } = await import("../src/service/auth.service.ts");

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const treeNode = {
  id: CANVAS_ID,
  user_id: USER_ID,
  parent_id: null,
  node_type: "canvas",
  title: "持久画布",
  sort_order: 1000,
  icon: null,
  color: null,
  metadata: {},
  revision: 1,
  deleted_at: null,
  deleted_root_id: null,
  created_at: NOW,
  updated_at: NOW,
};

const canvas = {
  node_id: CANVAS_ID,
  user_id: USER_ID,
  origin_node_id: MEMO_ID,
  origin_revision: 3,
  viewport: {},
  metadata: {},
  canvas_kind: "memo_default",
  version: 4,
  created_at: NOW,
  updated_at: NOW,
};

class CanvasV2Mock {
  readonly calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  readonly nodes: Array<Omit<typeof treeNode, "parent_id" | "deleted_at"> & {
    parent_id: string | null;
    deleted_at: string | null;
  }> = [];
  readonly namingQueries: URL[] = [];
  creationError: string | null = null;
  headersMatched = true;

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    this.headersMatched &&=
      request.headers.get("apikey") === PUBLISHABLE_KEY
      && request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`;

    if (url.pathname === "/auth/v1/user") {
      return json({ id: USER_ID, email: "canvas-v2@example.com" });
    }

    if (url.pathname === "/rest/v1/memo_nodes" && request.method === "GET") {
      this.namingQueries.push(url);
      const parentId = url.searchParams.get("parent_id");
      return json(this.nodes.filter((node) =>
        `eq.${node.user_id}` === url.searchParams.get("user_id")
        && `eq.${node.node_type}` === url.searchParams.get("node_type")
        && node.deleted_at === null
        && (node.parent_id === null ? "is.null" : `eq.${node.parent_id}`) === parentId));
    }

    if (!url.pathname.startsWith("/rest/v1/rpc/")) {
      throw new Error(`Unexpected path: ${url.pathname}`);
    }

    const name = url.pathname.slice("/rest/v1/rpc/".length);
    const body = (await request.json()) as Record<string, unknown>;
    this.calls.push({ name, body });

    if (body["p_user_id"] !== USER_ID) {
      return json({ status: "not_found" });
    }

    if (name === "get_or_create_memo_canvas") {
      return json({
        status: "existing",
        canvas,
        node: treeNode,
        focus_node_id: NODE_ID,
      });
    }

    if (name === "create_standalone_canvas") {
      if (this.creationError !== null) return json({ code: this.creationError, message: "private storage details" }, 400);
      const title = String(body["p_title"]);
      const parentId = body["p_parent_id"] == null ? null : String(body["p_parent_id"]);
      const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
      if (this.nodes.some((node) => node.node_type === "canvas"
        && node.user_id === USER_ID && node.parent_id === parentId
        && node.deleted_at === null && normalize(node.title) === normalize(title))) {
        return json({ code: "23505", message: "duplicate title" }, 409);
      }
      const node = { ...treeNode, id: crypto.randomUUID(), title, parent_id: parentId };
      this.nodes.push(node);
      return json({
        status: "created",
        canvas: {
          ...canvas,
          node_id: node.id,
          canvas_kind: "standalone",
          origin_node_id: null,
          origin_revision: null,
          version: 0,
        },
        node,
        focus_node_id: null,
      });
    }

    if (name === "read_canvas_v2") {
      return json({ status: "ok", canvas, node: treeNode, nodes: [], edges: [] });
    }

    if (name === "read_canvas_expansion_context") {
      return json({
        status: "ok",
        canvas_version: 4,
        corpus_version: 9,
        source: {
          canvas_node_id: NODE_ID,
          memo_id: MEMO_ID,
          title: "源笔记",
          excerpt: "摘要",
          revision: 3,
        },
        checkpoint: null,
        neighbor_memo_ids: [],
      });
    }

    if (name === "apply_canvas_mutation") {
      if (body["p_mutation_id"] === REUSE_ID) {
        return json({
          status: "mutation_id_reused",
          mutation_id: REUSE_ID,
          version: 4,
        });
      }
      if (body["p_base_version"] === 99) {
        return json({
          status: "version_conflict",
          mutation_id: MUTATION_ID,
          version: 4,
        });
      }

      return json({
        status: "applied",
        mutation_id: body["p_mutation_id"],
        intent_digest: "a".repeat(64),
        version: Number(body["p_base_version"]) + 1,
        upserted_nodes: [],
        removed_node_ids: [],
        upserted_edges: [],
        removed_edge_ids: [],
        aliases: [],
        noops: [],
        dropped: [],
        expansion_status: body["p_expansion"] === null ? null : "complete",
      });
    }

    throw new Error(`Unexpected RPC: ${name}`);
  };
}

const originalFetch = globalThis.fetch;
let mock: CanvasV2Mock;

beforeEach(() => {
  authService.resetIdentityCacheForTests();
  mock = new CanvasV2Mock();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const request = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });

const mutationBody = (overrides: Record<string, unknown> = {}) => ({
  protocol_version: 2,
  mutation_id: MUTATION_ID,
  base_version: 4,
  operations: [{
    type: "create_text",
    node_id: NODE_ID,
    text: "本地文字",
    x: 10,
    y: 20,
  }],
  ...overrides,
});

describe("Canvas V2 持久入口", () => {
  const createBlank = (input: Record<string, unknown> = {}) => app.request(request("/canvases", {
    method: "POST",
    body: JSON.stringify({ protocol_version: 2, ...input }),
  }));

  test("已有未命名 Canvas 后仍可连续创建，省略标题也走同一编号规则", async () => {
    mock.nodes.push({ ...treeNode, title: "未命名 Canvas" });
    for (let ordinal = 2; ordinal <= 5; ordinal++) {
      const response = await createBlank();
      expect(response.status).toBe(200);
      expect((await response.json()).data.node.title).toBe(`未命名 Canvas ${ordinal}`);
    }
    expect(new Set(mock.nodes.map((node) => node.id)).size).toBe(5);
  });

  test("超过 20 个画布直接取同目录最大号，不填空号、不跨类型/目录/用户或回收站", async () => {
    mock.nodes.push(
      { ...treeNode, title: "未命名 Canvas 2" },
      { ...treeNode, title: "  未命名   canvas 35  " },
      { ...treeNode, title: "未命名 Canvas 90", node_type: "memo" },
      { ...treeNode, title: "未命名 Canvas 91", parent_id: MEMO_ID },
      { ...treeNode, title: "未命名 Canvas 92", user_id: MEMO_ID },
      { ...treeNode, title: "未命名 Canvas 93", deleted_at: NOW },
    );
    const response = await createBlank({ title: "未命名 Canvas" });
    expect(response.status).toBe(200);
    expect((await response.json()).data.node.title).toBe("未命名 Canvas 36");
    expect(mock.calls.filter((call) => call.name === "create_standalone_canvas")).toHaveLength(1);
    const scoped = await createBlank({ parent_id: MEMO_ID, title: "未命名 Canvas" });
    expect(scoped.status).toBe(200);
    expect((await scoped.json()).data.node.title).toBe("未命名 Canvas 92");
    expect(mock.namingQueries[1]?.searchParams.get("parent_id")).toBe(`eq.${MEMO_ID}`);
  });

  test("已占号请求直接创建，两个客户端撞号后重读最大号继续创建", async () => {
    const responses = await Promise.all([
      createBlank({ title: "未命名 Canvas 3" }),
      createBlank({ title: "未命名 Canvas 3" }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(bodies.map((body) => body.data.node.title).sort()).toEqual(["未命名 Canvas 3", "未命名 Canvas 4"]);
    expect(mock.namingQueries).toHaveLength(1);
  });

  test("非重名的存储错误保持净化且不触发让号重试", async () => {
    mock.creationError = "42501";
    const response = await createBlank({ title: "未命名 Canvas 3" });
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("CANVAS_STORAGE_ERROR");
    expect(mock.calls).toHaveLength(1);
    expect(mock.namingQueries).toHaveLength(0);
  });

  test("同一 memo 的并发 PUT 只接收数据库返回的同一个 Canvas ID", async () => {
    const responses = await Promise.all([
      app.request(request(`/memos/${MEMO_ID}/canvas`, { method: "PUT" })),
      app.request(request(`/memos/${MEMO_ID}/canvas`, { method: "PUT" })),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(bodies.map((body) => body.data.canvas.node_id)).toEqual([
      CANVAS_ID,
      CANVAS_ID,
    ]);
    expect(bodies[0].data.focus_node_id).toBe(NODE_ID);
    expect(mock.calls.every((call) => call.name === "get_or_create_memo_canvas"))
      .toBe(true);
    expect(mock.calls.every((call) => call.body["p_user_id"] === USER_ID))
      .toBe(true);
  });

  test("空白 Canvas 从创建起就是 protocol=2 的真实 standalone", async () => {
    const response = await app.request(request("/canvases", {
      method: "POST",
      body: JSON.stringify({ protocol_version: 2, title: "空白空间" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      created: true,
      focus_node_id: null,
      canvas: { node_id: body.data.node.id, canvas_kind: "standalone", version: 0 },
    });
    expect(mock.calls[0]).toMatchObject({ name: "create_standalone_canvas" });
  });

  test("多余 user_id 被 strict DTO 拒绝，绝不下传 RPC", async () => {
    const response = await app.request(request("/canvases", {
      method: "POST",
      body: JSON.stringify({
        protocol_version: 2,
        title: "越权输入",
        user_id: "99999999-9999-4999-8999-999999999999",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("旧 save/layout/card/promote HTTP 写入口全部失效", async () => {
    const oldSave = await app.request(request("/canvases", {
      body: JSON.stringify({ origin_node_id: MEMO_ID, items: [], title: "旧保存" }),
      method: "POST",
    }));
    const oldLayout = await app.request(request(`/canvases/${CANVAS_ID}`, {
      body: JSON.stringify({ cards: [], viewport: {} }),
      method: "PATCH",
    }));
    const oldCard = await app.request(request(`/canvases/${CANVAS_ID}/cards`, {
      body: JSON.stringify({ kind: "native", text: "旧卡片" }),
      method: "POST",
    }));
    const oldPromote = await app.request(request(`/canvas-cards/${NODE_ID}/promote`, {
      body: JSON.stringify({}),
      method: "POST",
    }));

    expect([oldSave.status, oldLayout.status, oldCard.status, oldPromote.status])
      .toEqual([400, 400, 404, 404]);
    expect(mock.calls).toEqual([]);
  });
});

describe("Canvas V2 唯一 mutation 内核", () => {
  test("人工 PATCH 只调用 apply_canvas_mutation 且 expansion 明确为 null", async () => {
    const response = await app.request(request(`/canvases/${CANVAS_ID}`, {
      method: "PATCH",
      body: JSON.stringify(mutationBody({
        operations: [{
          height: 72,
          node_id: NODE_ID,
          text: "空间文字",
          text_scale: 1.5,
          type: "create_text",
          width: 240,
          x: 10,
          y: 20,
        }],
      })),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ mutation_id: MUTATION_ID, version: 5 });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({
      name: "apply_canvas_mutation",
      body: {
        p_user_id: USER_ID,
        p_canvas_id: CANVAS_ID,
        p_protocol_version: 2,
        p_mutation_id: MUTATION_ID,
        p_base_version: 4,
        p_expansion: null,
        p_operations: [{
          height: 72,
          node_id: NODE_ID,
          text: "空间文字",
          text_scale: 1.5,
          type: "create_text",
          width: 240,
          x: 10,
          y: 20,
        }],
      },
    });
  });

  test("自由文字缩放比例越界时在 DTO 层拒绝", async () => {
    const response = await app.request(request(`/canvases/${CANVAS_ID}`, {
      method: "PATCH",
      body: JSON.stringify(mutationBody({
        operations: [{
          node_id: NODE_ID,
          text_scale: 8.01,
          type: "update_node",
        }],
      })),
    }));

    expect(response.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("409 返回当前 version，供 WAL 保留 intent 后安全 rebase", async () => {
    const response = await app.request(request(`/canvases/${CANVAS_ID}`, {
      method: "PATCH",
      body: JSON.stringify(mutationBody({ base_version: 99 })),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      code: "CANVAS_VERSION_CONFLICT",
      message: "Canvas changed in another session",
      data: { mutation_id: MUTATION_ID, version: 4 },
    });
  });

  test("同 mutation_id 偷换意图映射为稳定 409", async () => {
    const response = await app.request(request(`/canvases/${CANVAS_ID}`, {
      method: "PATCH",
      body: JSON.stringify(mutationBody({ mutation_id: REUSE_ID })),
    }));

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("MUTATION_ID_REUSED");
  });

  test("超长文字在 DTO 层拒绝，不触达统一写内核", async () => {
    const response = await app.request(request(`/canvases/${CANVAS_ID}`, {
      method: "PATCH",
      body: JSON.stringify(mutationBody({
        operations: [{
          type: "create_text",
          node_id: NODE_ID,
          text: "字".repeat(5001),
          x: 0,
          y: 0,
        }],
      })),
    }));

    expect(response.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("AI commit 仍调用同一函数，只多传可信 expansion 元数据", async () => {
    const input = {
      ...mutationBody(),
      source_canvas_node_id: NODE_ID,
      source_revision: 3,
      corpus_version: 9,
      request_id: REQUEST_ID,
      completion_status: "complete",
      candidate_revisions: [{ memo_id: MEMO_ID, revision: 3 }],
    };
    const response = await app.request(request(
      `/canvases/${CANVAS_ID}/expansions`,
      { method: "POST", body: JSON.stringify(input) },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.expansion_status).toBe("complete");
    expect(mock.calls[0]?.name).toBe("apply_canvas_mutation");
    expect(mock.calls[0]?.body["p_expansion"]).toEqual({
      source_canvas_node_id: NODE_ID,
      source_revision: 3,
      corpus_version: 9,
      request_id: REQUEST_ID,
      completion_status: "complete",
      candidate_revisions: [{ memo_id: MEMO_ID, revision: 3 }],
    });
  });
});

describe("Canvas expansion context", () => {
  test("只返回可信 source/revision/corpus/checkpoint/邻居，不含正文", async () => {
    const response = await app.request(request(
      `/canvases/${CANVAS_ID}/nodes/${NODE_ID}/expansion-context`,
    ));
    const raw = await response.text();
    const body = JSON.parse(raw);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      canvas_version: 4,
      corpus_version: 9,
      source: { memo_id: MEMO_ID, revision: 3 },
      checkpoint: null,
    });
    expect(raw).not.toContain("content_mdx");
    expect(mock.headersMatched).toBe(true);
  });
});
