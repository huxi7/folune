/**
 * [INPUT]: 依赖 Bun test、Hono app、Web fetch、内存 Supabase Auth/PostgREST/RPC mock 与 memo/canvas 领域模型
 * [OUTPUT]: 覆盖画布保存/读取/布局/晋升的认证、房规、跨租户、失联候选跳过、晋升原子性与幂等，以及「载荷永不含正文」
 * [POS]: api/test 的知识画布 HTTP 全链路契约测试；RPC mock 忠实复刻 SQL 语义（含 text 置空与 memo_ref 幂等），因此这里的断言等于对数据库契约的断言
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { MemoContent, MemoNode } from "../src/model/memo.model.ts";

// 与其余测试文件共用同一组 Supabase 常量: config 模块在进程内只初始化一次，
// 各文件若各写一套，先加载者会赢，headers 断言便会莫名失败。
const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "canvas-test-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-24T10:00:00.000Z";

const ORIGIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RELATED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DELETED_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOLDER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CANVAS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CARD_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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
  node_type: "memo",
  title: "笔记",
  sort_order: 1000,
  icon: null,
  color: null,
  metadata: {},
  revision: 3,
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
  content_mdx: "少则得，多则惑。",
  excerpt: "少则得，多则惑。",
  word_count: 8,
  metadata: {},
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

type CardRow = {
  anchor: Record<string, unknown>;
  anchored_rev: number | null;
  canvas_id: string;
  created_at: string;
  created_by: "ai" | "user";
  id: string;
  kind: "excerpt" | "memo_ref" | "native";
  metadata: Record<string, unknown>;
  position_x: number;
  position_y: number;
  target_node_id: string | null;
  text: string | null;
  updated_at: string;
  user_id: string;
};

const cardFixture = (id: string, overrides: Partial<CardRow> = {}): CardRow => ({
  anchor: {},
  anchored_rev: null,
  canvas_id: CANVAS_ID,
  created_at: NOW,
  created_by: "ai",
  id,
  kind: "excerpt",
  metadata: {},
  position_x: 0,
  position_y: 0,
  target_node_id: null,
  text: "损之又损，以至于无为。删掉一个功能比加一个功能需要更多的确信。",
  updated_at: NOW,
  user_id: USER_ID,
  ...overrides,
});

class MockSupabase {
  readonly canvases = new Map<string, Record<string, unknown>>();
  readonly cards = new Map<string, CardRow>();
  readonly contents = new Map<string, MemoContent>();
  readonly edges: Record<string, unknown>[] = [];
  readonly nodes = new Map<string, MemoNode>();
  readonly operations: string[] = [];
  readonly relations: Record<string, unknown>[] = [];
  readonly rpcBodies: { body: Record<string, unknown>; name: string }[] = [];
  headersMatched = true;
  private idCounter = 20;

  constructor() {
    this.nodes.set(ORIGIN_ID, nodeFixture(ORIGIN_ID, { title: "过度设计与熵" }));
    this.nodes.set(RELATED_ID, nodeFixture(RELATED_ID, { title: "少则得" }));
    this.nodes.set(
      DELETED_ID,
      nodeFixture(DELETED_ID, {
        deleted_at: NOW,
        deleted_root_id: DELETED_ID,
        title: "已删除",
      }),
    );
    this.nodes.set(
      FOLDER_ID,
      nodeFixture(FOLDER_ID, { node_type: "folder", sort_order: 4000, title: "思考" }),
    );
    this.contents.set(ORIGIN_ID, contentFixture(ORIGIN_ID));
    this.contents.set(RELATED_ID, contentFixture(RELATED_ID));
  }

  private nextId(): string {
    this.idCounter += 1;
    return `77777777-7777-4777-8777-7777777777${this.idCounter}`;
  }

  readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    this.headersMatched &&=
      request.headers.get("apikey") === PUBLISHABLE_KEY &&
      request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`;

    if (url.pathname === "/auth/v1/user") {
      this.operations.push("auth:get");
      return jsonResponse({ id: USER_ID, email: "canvas-test@example.com" });
    }

    if (url.pathname === "/rest/v1/memo_nodes") {
      return this.handleNodes(url);
    }

    if (url.pathname === "/rest/v1/canvases") {
      this.operations.push("select:canvases");
      const idFilter = url.searchParams.get("node_id")?.slice("eq.".length);
      const rows = [...this.canvases.values()].filter((canvas) =>
        canvas["user_id"] === USER_ID
        && (idFilter === undefined || canvas["node_id"] === idFilter));

      return jsonResponse(rows.map((canvas) => ({ node_id: canvas["node_id"] })));
    }

    if (url.pathname === "/rest/v1/canvas_nodes") {
      return request.method === "POST"
        ? this.insertCard(request)
        : this.handleCards(url);
    }

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return this.handleRpc(request, url.pathname.slice("/rest/v1/rpc/".length));
    }

    throw new Error(`Unexpected path: ${url.pathname}`);
  };

  /** 服务 nextSortOrder 的同级最大值查询与 findActiveNodeById 的单节点查询 */
  private handleNodes(url: URL): Response {
    this.operations.push("select:memo_nodes");
    const idFilter = url.searchParams.get("id")?.slice("eq.".length);

    if (idFilter !== undefined) {
      const node = this.nodes.get(idFilter);

      return jsonResponse(
        node === undefined || node.deleted_at !== null ? [] : [node],
      );
    }

    const parentFilter = url.searchParams.get("parent_id");
    const rows = [...this.nodes.values()]
      .filter((node) => node.user_id === USER_ID && node.deleted_at === null)
      .filter((node) => (parentFilter === "is.null"
        ? node.parent_id === null
        : parentFilter === null || node.parent_id === parentFilter.slice("eq.".length)))
      .sort((left, right) => right.sort_order - left.sort_order);

    return jsonResponse(
      url.searchParams.get("select") === "sort_order"
        ? rows.slice(0, 1).map(({ sort_order }) => ({ sort_order }))
        : rows,
    );
  }

  private handleCards(url: URL): Response {
    this.operations.push("select:canvas_nodes");
    const idFilter = url.searchParams.get("id")?.slice("eq.".length);
    const rows = [...this.cards.values()].filter((card) =>
      card.user_id === USER_ID && (idFilter === undefined || card.id === idFilter));

    return jsonResponse(rows.map(({ id, kind, text }) => ({ id, kind, text })));
  }

  private async insertCard(request: Request): Promise<Response> {
    this.operations.push("insert:canvas_nodes");
    const data = (await request.json()) as Record<string, unknown>;
    const card = cardFixture(this.nextId(), {
      anchor: (data["anchor"] ?? {}) as Record<string, unknown>,
      anchored_rev: data["anchored_rev"] === null
        ? null
        : Number(data["anchored_rev"]),
      canvas_id: String(data["canvas_id"]),
      created_by: "user",
      kind: data["kind"] as CardRow["kind"],
      position_x: Number(data["position_x"] ?? 0),
      position_y: Number(data["position_y"] ?? 0),
      target_node_id: data["target_node_id"] === null
        ? null
        : String(data["target_node_id"]),
      text: String(data["text"]),
    });
    this.cards.set(card.id, card);

    return jsonResponse([card]);
  }

  private async handleRpc(request: Request, name: string): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    this.rpcBodies.push({ body, name });
    this.operations.push(`rpc:${name}`);

    // 每个 RPC 的第一道闸门都是 auth.uid() 与 p_user_id 相符
    if (body["p_user_id"] !== USER_ID) {
      return jsonResponse({ status: "not_found" });
    }

    if (name === "save_exploration_canvas") return this.save(body);
    if (name === "read_canvas") return this.read(body);
    if (name === "update_canvas_layout") return this.layout(body);
    if (name === "promote_canvas_node") return this.promote(body);

    throw new Error(`Unexpected rpc: ${name}`);
  }

  private save(body: Record<string, unknown>): Response {
    const origin = this.nodes.get(String(body["p_origin_node_id"]));

    if (
      origin === undefined
      || origin.node_type !== "memo"
      || origin.deleted_at !== null
    ) {
      return jsonResponse({ status: "origin_not_found" });
    }

    const parentId = body["p_parent_id"] === null
      ? null
      : String(body["p_parent_id"]);

    if (parentId !== null) {
      const parent = this.nodes.get(parentId);
      if (parent === undefined || parent.node_type !== "folder") {
        return jsonResponse({ status: "parent_not_found" });
      }
    }

    const treeNode = nodeFixture(this.nextId(), {
      node_type: "canvas",
      parent_id: parentId,
      revision: 1,
      sort_order: Number(body["p_sort_order"]),
      title: String(body["p_title"]).trim(),
    });
    this.nodes.set(treeNode.id, treeNode);

    const canvas = {
      created_at: NOW,
      metadata: {},
      node_id: treeNode.id,
      origin_node_id: origin.id,
      origin_revision: origin.revision,
      updated_at: NOW,
      user_id: USER_ID,
      viewport: body["p_viewport"] ?? {},
    };
    this.canvases.set(treeNode.id, canvas);

    const center = cardFixture(this.nextId(), {
      anchored_rev: origin.revision,
      canvas_id: treeNode.id,
      created_by: "user",
      kind: "memo_ref",
      target_node_id: origin.id,
      text: null,
    });
    this.cards.set(center.id, center);

    let saved = 0;
    let skipped = 0;

    for (const raw of (body["p_items"] as Record<string, unknown>[]) ?? []) {
      const target = this.nodes.get(String(raw["node_id"]));

      if (
        target === undefined
        || target.node_type !== "memo"
        || target.deleted_at !== null
        || target.id === origin.id
      ) {
        skipped += 1;
        continue;
      }

      const card = cardFixture(this.nextId(), {
        anchored_rev: Number(raw["revision"] ?? target.revision),
        canvas_id: treeNode.id,
        kind: "memo_ref",
        position_x: Number(raw["x"] ?? 0),
        position_y: Number(raw["y"] ?? 0),
        target_node_id: target.id,
        text: null,
      });
      this.cards.set(card.id, card);
      this.edges.push({
        canvas_id: treeNode.id,
        created_by: "ai",
        id: this.nextId(),
        rationale: raw["reason"] ?? null,
        source_id: center.id,
        target_id: card.id,
      });
      this.relations.push({
        confidence: raw["confidence"] ?? null,
        evidence: { excerpt: raw["excerpt"] ?? null },
        origin: "explore",
        source_node_id: origin.id,
        target_node_id: target.id,
      });
      saved += 1;
    }

    return jsonResponse({
      canvas,
      card_count: saved,
      node: treeNode,
      skipped_count: skipped,
      status: "created",
    });
  }

  private read(body: Record<string, unknown>): Response {
    const canvasId = String(body["p_canvas_id"]);
    const treeNode = this.nodes.get(canvasId);
    const canvas = this.canvases.get(canvasId);

    if (
      treeNode === undefined
      || treeNode.node_type !== "canvas"
      || treeNode.deleted_at !== null
      || canvas === undefined
    ) {
      return jsonResponse({ status: "not_found" });
    }

    const cards = [...this.cards.values()]
      .filter((card) => card.canvas_id === canvasId)
      .map((card) => {
        const target = card.target_node_id === null
          ? undefined
          : this.nodes.get(card.target_node_id);

        return {
          anchor: card.anchor,
          anchored_rev: card.anchored_rev,
          created_by: card.created_by,
          id: card.id,
          kind: card.kind,
          position_x: card.position_x,
          position_y: card.position_y,
          // 投影只带标题与既有摘要，正文永不出库
          target: target === undefined ? null : {
            deleted_at: target.deleted_at,
            excerpt: this.contents.get(target.id)?.excerpt ?? null,
            node_id: target.id,
            revision: target.revision,
            title: target.title,
          },
          target_node_id: card.target_node_id,
          text: card.text,
        };
      });

    return jsonResponse({
      canvas,
      cards,
      edges: this.edges.filter((edge) => edge["canvas_id"] === canvasId),
      node: treeNode,
      status: "ok",
    });
  }

  private layout(body: Record<string, unknown>): Response {
    const canvasId = String(body["p_canvas_id"]);
    const canvas = this.canvases.get(canvasId);

    if (canvas === undefined) {
      return jsonResponse({ status: "not_found" });
    }

    if (body["p_viewport"] !== null && body["p_viewport"] !== undefined) {
      canvas["viewport"] = body["p_viewport"];
    }

    let moved = 0;

    for (const raw of (body["p_cards"] as Record<string, unknown>[]) ?? []) {
      const card = this.cards.get(String(raw["id"]));
      if (card === undefined || card.canvas_id !== canvasId) {
        continue;
      }
      card.position_x = Number(raw["x"]);
      card.position_y = Number(raw["y"]);
      moved += 1;
    }

    return jsonResponse({ canvas, moved_count: moved, status: "updated" });
  }

  private promote(body: Record<string, unknown>): Response {
    const card = this.cards.get(String(body["p_canvas_node_id"]));

    if (card === undefined) {
      return jsonResponse({ status: "not_found" });
    }

    if (card.kind === "memo_ref") {
      const target = card.target_node_id === null
        ? undefined
        : this.nodes.get(card.target_node_id);

      return jsonResponse({
        card,
        memo: target === undefined
          ? null
          : this.contents.get(target.id) ?? null,
        node: target ?? null,
        status: "already_promoted",
      });
    }

    if (card.text === null || card.text.trim() === "") {
      return jsonResponse({
        error_code: "CANVAS_CARD_EMPTY",
        status: "invalid",
      });
    }

    const parentId = body["p_parent_id"] === null
      ? null
      : String(body["p_parent_id"]);

    if (parentId !== null) {
      const parent = this.nodes.get(parentId);
      if (parent === undefined || parent.node_type !== "folder") {
        return jsonResponse({ status: "parent_not_found" });
      }
    }

    const title = String(body["p_title"] ?? "").trim() === ""
      ? card.text.split("\n")[0]!.replace(/^#+\s*/u, "").trim()
      : String(body["p_title"]).trim();
    const treeNode = nodeFixture(this.nextId(), {
      parent_id: parentId,
      revision: 1,
      sort_order: Number(body["p_sort_order"]),
      title: title.slice(0, 500),
    });
    this.nodes.set(treeNode.id, treeNode);

    // 灵魂: 正文搬进 memos，同一次操作里把卡片的 text 置空并改成引用
    const memo = contentFixture(treeNode.id, {
      content_mdx: card.text,
      excerpt: body["p_excerpt"] === null ? null : String(body["p_excerpt"]),
      word_count: Number(body["p_word_count"] ?? 0),
    });
    this.contents.set(treeNode.id, memo);

    card.kind = "memo_ref";
    card.target_node_id = treeNode.id;
    card.anchored_rev = treeNode.revision;
    card.text = null;
    card.anchor = {};

    return jsonResponse({ card, memo, node: treeNode, status: "promoted" });
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

const saveBody = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  items: [
    {
      confidence: 0.92,
      excerpt: "少则得，多则惑。",
      matched_channels: ["keyword"],
      node_id: RELATED_ID,
      reason: "同一命题的另一种表述",
      revision: 3,
      x: 420,
      y: -180,
    },
  ],
  origin_node_id: ORIGIN_ID,
  title: "「过度设计与熵」的关联",
  ...overrides,
});

describe("画布接口房规", () => {
  test("四个入口没有 Bearer token 一律 401，且不触达任何存储操作", async () => {
    const requests = [
      app.request("/canvases", { method: "POST" }),
      app.request(`/canvases/${CANVAS_ID}`),
      app.request(`/canvases/${CANVAS_ID}`, { method: "PATCH" }),
      app.request(`/canvas-cards/${CARD_ID}/promote`, { method: "POST" }),
    ];

    for (const response of await Promise.all(requests)) {
      expect(response.status).toBe(401);
    }
    expect(mock.operations).toEqual([]);
  });

  test("RPC body 只携带可信参数: user_id 取自 token，绝不取自请求体", async () => {
    const response = await app.request(authenticatedRequest("/canvases", {
      body: saveBody({ user_id: "33333333-3333-4333-8333-333333333333" }),
      method: "POST",
    }));

    // strict schema 直接拒收多余字段，攻击面在校验层就关掉了
    expect(response.status).toBe(400);

    const accepted = await app.request(authenticatedRequest("/canvases", {
      body: saveBody(),
      method: "POST",
    }));
    expect(accepted.status).toBe(200);
    const call = mock.rpcBodies.find((entry) => entry.name === "save_exploration_canvas");
    expect(call?.body["p_user_id"]).toBe(USER_ID);
    expect(mock.headersMatched).toBe(true);
  });

  test("跨租户画布读取返回 404，而不是泄漏存在性", async () => {
    const response = await app.request(
      authenticatedRequest(`/canvases/${MISSING_ID}`),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("CANVAS_NOT_FOUND");
  });
});

describe("保存探索结果", () => {
  test("四张表一次落地: 画布节点、画布、卡片与边、正式关联", async () => {
    const response = await app.request(authenticatedRequest("/canvases", {
      body: saveBody({ parent_id: FOLDER_ID }),
      method: "POST",
    }));

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.node.node_type).toBe("canvas");
    expect(data.node.parent_id).toBe(FOLDER_ID);
    expect(data.card_count).toBe(1);
    expect(data.skipped_count).toBe(0);
    expect(data.canvas.origin_node_id).toBe(ORIGIN_ID);
    // 出处的 revision 是保存那一刻的事实，由数据库读取而非客户端声明
    expect(data.canvas.origin_revision).toBe(3);
    // 中心卡片 + 一张关联卡片
    expect(mock.cards.size).toBe(2);
    expect(mock.edges).toHaveLength(1);
    expect(mock.relations).toHaveLength(1);
    expect(mock.relations[0]).toMatchObject({
      origin: "explore",
      source_node_id: ORIGIN_ID,
      target_node_id: RELATED_ID,
    });
  });

  test("新画布的 sort_order 复用同级最大值加间隔，不另立一套算法", async () => {
    await app.request(authenticatedRequest("/canvases", {
      body: saveBody(),
      method: "POST",
    }));

    const call = mock.rpcBodies.find((entry) => entry.name === "save_exploration_canvas");
    // 根级同级最大值是 folder 的 4000
    expect(call?.body["p_sort_order"]).toBe(5000);
  });

  test("探索到保存之间失联的候选被跳过并如实计数，整次保存不作废", async () => {
    const response = await app.request(authenticatedRequest("/canvases", {
      body: saveBody({
        items: [
          { node_id: RELATED_ID, reason: "在" },
          { node_id: DELETED_ID, reason: "已删除" },
          { node_id: MISSING_ID, reason: "不存在" },
          { node_id: ORIGIN_ID, reason: "中心自己" },
        ],
      }),
      method: "POST",
    }));

    const { data } = await response.json();
    expect(data.card_count).toBe(1);
    expect(data.skipped_count).toBe(3);
  });

  test("出处不是本人 active 笔记时 404，父级不是文件夹时 404", async () => {
    const badOrigin = await app.request(authenticatedRequest("/canvases", {
      body: saveBody({ origin_node_id: DELETED_ID }),
      method: "POST",
    }));
    expect(badOrigin.status).toBe(404);
    expect((await badOrigin.json()).code).toBe("CANVAS_ORIGIN_NOT_FOUND");

    const badParent = await app.request(authenticatedRequest("/canvases", {
      body: saveBody({ parent_id: RELATED_ID }),
      method: "POST",
    }));
    expect(badParent.status).toBe(404);
    expect((await badParent.json()).code).toBe("MEMO_PARENT_NOT_FOLDER");
  });
});

describe("读取画布", () => {
  const saveThenRead = async (): Promise<{
    body: { data: Record<string, unknown> };
    raw: string;
  }> => {
    const created = await app.request(authenticatedRequest("/canvases", {
      body: saveBody(),
      method: "POST",
    }));
    const canvasId = (await created.json()).data.node.id;
    const response = await app.request(
      authenticatedRequest(`/canvases/${canvasId}`),
    );
    const raw = await response.text();

    return { body: JSON.parse(raw), raw };
  };

  test("引用卡片只带标题与既有摘要，整个载荷不含 content_mdx", async () => {
    const { body, raw } = await saveThenRead();
    const cards = body.data["cards"] as Record<string, unknown>[];

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ kind: "memo_ref", text: null });
    expect((cards[0]!["target"] as Record<string, unknown>)["title"])
      .toBe("过度设计与熵");
    expect(raw).not.toContain("content_mdx");
  });

  test("边带上人话理由，供画布还原「凭什么相关」", async () => {
    const { body } = await saveThenRead();
    const edges = body.data["edges"] as Record<string, unknown>[];

    expect(edges).toHaveLength(1);
    expect(edges[0]!["rationale"]).toBe("同一命题的另一种表述");
  });
});

describe("画布布局", () => {
  test("视口与卡片坐标一次提交，返回真实移动数", async () => {
    const created = await app.request(authenticatedRequest("/canvases", {
      body: saveBody(),
      method: "POST",
    }));
    const canvasId = (await created.json()).data.node.id;
    const cardId = [...mock.cards.values()]
      .find((card) => card.target_node_id === RELATED_ID)!.id;

    const response = await app.request(
      authenticatedRequest(`/canvases/${canvasId}`, {
        body: JSON.stringify({
          cards: [{ id: cardId, x: 120.5, y: -64 }],
          viewport: { x: 10, y: 20, zoom: 1.25 },
        }),
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.moved_count).toBe(1);
    expect(data.canvas.viewport).toEqual({ x: 10, y: 20, zoom: 1.25 });
    expect(mock.cards.get(cardId)?.position_x).toBe(120.5);
  });

  test("未知画布的布局提交返回 404", async () => {
    const response = await app.request(
      authenticatedRequest(`/canvases/${MISSING_ID}`, {
        body: JSON.stringify({ viewport: { zoom: 1 } }),
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("卡片晋升为笔记", () => {
  const seedExcerptCard = (): CardRow => {
    mock.canvases.set(CANVAS_ID, {
      created_at: NOW,
      metadata: {},
      node_id: CANVAS_ID,
      origin_node_id: ORIGIN_ID,
      origin_revision: 3,
      updated_at: NOW,
      user_id: USER_ID,
      viewport: {},
    });
    mock.nodes.set(
      CANVAS_ID,
      nodeFixture(CANVAS_ID, { node_type: "canvas", title: "关联画布" }),
    );
    const card = cardFixture(CARD_ID);
    mock.cards.set(card.id, card);

    return card;
  };

  test("同一次操作内建成笔记并把卡片正文置空——内容只剩一份", async () => {
    seedExcerptCard();
    const response = await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.already_promoted).toBe(false);
    expect(data.node.node_type).toBe("memo");
    expect(data.memo.content_mdx).toBe(
      "损之又损，以至于无为。删掉一个功能比加一个功能需要更多的确信。",
    );
    // 卡片就地变成引用，text 必须为空
    expect(data.card.kind).toBe("memo_ref");
    expect(data.card.text).toBeNull();
    expect(data.card.target_node_id).toBe(data.node.id);
    expect(mock.cards.get(CARD_ID)?.text).toBeNull();
    // 返回的卡片自带目标投影，前端无需二次读取
    expect(data.card.target.title).toBe(data.node.title);
  });

  test("摘要与字数由 service 从同一段正文派生，标题回退到正文首行", async () => {
    seedExcerptCard();
    await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );

    const call = mock.rpcBodies.find((entry) => entry.name === "promote_canvas_node");
    expect(call?.body["p_title"]).toBeNull();
    expect(call?.body["p_excerpt"]).toBe(
      "损之又损，以至于无为。删掉一个功能比加一个功能需要更多的确信。",
    );
    // 汉字逐字计数：与 memo.service 的既有规则同源
    expect(call?.body["p_word_count"]).toBe(28);
  });

  test("重复晋升幂等: 只回报已晋升并带回原目标，不再建第二篇", async () => {
    seedExcerptCard();
    const first = await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );
    const firstNodeId = (await first.json()).data.node.id;
    const nodeCount = mock.nodes.size;

    const second = await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );

    expect(second.status).toBe(200);
    const { data } = await second.json();
    expect(data.already_promoted).toBe(true);
    expect(data.node.id).toBe(firstNodeId);
    expect(mock.nodes.size).toBe(nodeCount);
  });

  test("空白卡片拒绝晋升，未知卡片 404", async () => {
    mock.cards.set(CARD_ID, cardFixture(CARD_ID, { text: "   " }));
    const empty = await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );
    expect(empty.status).toBe(400);
    expect((await empty.json()).code).toBe("CANVAS_CARD_EMPTY");

    const missing = await app.request(
      authenticatedRequest(`/canvas-cards/${MISSING_ID}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("CANVAS_CARD_NOT_FOUND");
  });

  test("指定文件夹晋升时校验父级，非文件夹返回 404", async () => {
    seedExcerptCard();
    const response = await app.request(
      authenticatedRequest(`/canvas-cards/${CARD_ID}/promote`, {
        body: JSON.stringify({ parent_id: RELATED_ID }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("MEMO_PARENT_NOT_FOLDER");
  });
});

describe("往画布上放卡片", () => {
  const seedCanvas = (): void => {
    mock.nodes.set(
      CANVAS_ID,
      nodeFixture(CANVAS_ID, { node_type: "canvas", title: "关联画布" }),
    );
    mock.canvases.set(CANVAS_ID, {
      created_at: NOW,
      metadata: {},
      node_id: CANVAS_ID,
      origin_node_id: ORIGIN_ID,
      origin_revision: 3,
      updated_at: NOW,
      user_id: USER_ID,
      viewport: {},
    });
  };

  test("摘录卡片记下出处与成立时的 revision，返回时自带目标投影", async () => {
    seedCanvas();
    const response = await app.request(
      authenticatedRequest(`/canvases/${CANVAS_ID}/cards`, {
        body: JSON.stringify({
          kind: "excerpt",
          source_node_id: RELATED_ID,
          text: "少则得，多则惑。",
          x: 120,
          y: -40,
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.kind).toBe("excerpt");
    expect(data.target_node_id).toBe(RELATED_ID);
    expect(data.anchored_rev).toBe(3);
    expect(data.target.title).toBe("少则得");
    expect(data.created_by).toBe("user");
  });

  test("原生卡片不需要出处；摘录卡片缺出处直接 400", async () => {
    seedCanvas();
    const native = await app.request(
      authenticatedRequest(`/canvases/${CANVAS_ID}/cards`, {
        body: JSON.stringify({ kind: "native", text: "写在画布上的一句话" }),
        method: "POST",
      }),
    );
    expect(native.status).toBe(200);
    expect((await native.json()).data.target_node_id).toBeNull();

    const missingSource = await app.request(
      authenticatedRequest(`/canvases/${CANVAS_ID}/cards`, {
        body: JSON.stringify({ kind: "excerpt", text: "缺出处" }),
        method: "POST",
      }),
    );
    expect(missingSource.status).toBe(400);
  });

  test("未知画布 404，出处不是本人 active 笔记 404", async () => {
    const unknownCanvas = await app.request(
      authenticatedRequest(`/canvases/${MISSING_ID}/cards`, {
        body: JSON.stringify({ kind: "native", text: "x" }),
        method: "POST",
      }),
    );
    expect(unknownCanvas.status).toBe(404);
    expect((await unknownCanvas.json()).code).toBe("CANVAS_NOT_FOUND");

    seedCanvas();
    const deletedSource = await app.request(
      authenticatedRequest(`/canvases/${CANVAS_ID}/cards`, {
        body: JSON.stringify({
          kind: "excerpt",
          source_node_id: DELETED_ID,
          text: "已删除的出处",
        }),
        method: "POST",
      }),
    );
    expect(deletedSource.status).toBe(404);
    expect((await deletedSource.json()).code).toBe("MEMO_NOT_FOUND");
  });

  test("新增卡片后即可晋升: 卡片正文搬进笔记，卡片原地变引用", async () => {
    seedCanvas();
    const created = await app.request(
      authenticatedRequest(`/canvases/${CANVAS_ID}/cards`, {
        body: JSON.stringify({ kind: "native", text: "# 一句要留下的话\n它值得成为一篇。" }),
        method: "POST",
      }),
    );
    const cardId = (await created.json()).data.id;

    const promoted = await app.request(
      authenticatedRequest(`/canvas-cards/${cardId}/promote`, {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );

    expect(promoted.status).toBe(200);
    const { data } = await promoted.json();
    expect(data.node.title).toBe("一句要留下的话");
    expect(data.card.kind).toBe("memo_ref");
    expect(data.card.text).toBeNull();
    expect(mock.contents.get(data.node.id)?.content_mdx)
      .toBe("# 一句要留下的话\n它值得成为一篇。");
  });
});
