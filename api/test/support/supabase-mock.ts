/**
 * [INPUT]: 依赖 memo 领域创建/行类型与 Bun 环境变量，只在测试进程内生效
 * [OUTPUT]: 对外提供测试常量、node/content fixture、内存 Supabase Auth/PostgREST/RPC mock（含两条标题唯一索引语义）与带 Bearer 的请求构造器
 * [POS]: api/test 的共享替身边界；memo 与 memo 命名两组契约测试共用同一份 mock，避免两处各自复刻一遍 PostgREST 行为而彼此漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  CreateMemoContentData,
  CreateMemoNodeData,
  MemoContent,
  MemoNode,
} from "../../src/model/memo.model.ts";

export const SUPABASE_URL = "https://profile-test.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_profile_test";
export const ACCESS_TOKEN = "profile-test-access-token";
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
export const NOW = "2026-08-05T14:00:00.000Z";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

export const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const nodeFixture = (
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

export const contentFixture = (
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

export type MockOptions = {
  invalidToken?: boolean;
  rejectContentCreate?: boolean;
};

export class MockSupabase {
  readonly nodes = new Map<string, MemoNode>();
  readonly contents = new Map<string, MemoContent>();
  readonly canvases = new Map<string, {
    canvas_kind: "memo_default" | "standalone";
    node_id: string;
    origin_node_id: string | null;
    user_id: string;
  }>();
  readonly operations: string[] = [];
  readonly requestedUrls: string[] = [];
  readonly rpcBodies: { body: Record<string, unknown>; name: string }[] = [];
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

    if (url.pathname === "/rest/v1/canvases") {
      this.operations.push("canvases:get");
      const userId = this.assertUserFilter(url);
      return jsonResponse(
        Array.from(this.canvases.values())
          .filter((row) => row.user_id === userId)
          .map(({ canvas_kind, node_id, origin_node_id }) => ({
            canvas_kind,
            node_id,
            origin_node_id,
          })),
      );
    }

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return this.handleRpc(request, url.pathname.slice("/rest/v1/rpc/".length));
    }

    throw new Error(`Unexpected path: ${url.pathname}`);
  };

  private async handleRpc(request: Request, name: string): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    this.rpcBodies.push({ body, name });
    this.operations.push(`rpc:${name}`);

    if (body["p_user_id"] !== USER_ID) {
      return jsonResponse({ status: "not_found" });
    }

    const rawQuery = String(body["p_query_text"] ?? "").trim();
    if (rawQuery === "") {
      return jsonResponse({
        error_code: "MEMO_SEARCH_QUERY_EMPTY",
        status: "invalid",
      });
    }

    // 忠实复刻 RPC 语义：必须存在对应 memo_nodes 行、node_type='memo' 且未被软删除。
    // 这正是新实现相对旧 ilike 路径修掉的漏洞，故 mock 不做宽松处理。
    const searchable = [...this.contents.values()].filter((content) => {
      const node = this.nodes.get(content.node_id);
      return content.user_id === USER_ID
        && node !== undefined
        && node.node_type === "memo"
        && node.deleted_at === null;
    });

    if (name === "search_memos_keyword") {
      const keyword = rawQuery.toLocaleLowerCase();
      const hits = searchable
        .filter((content) => {
          const node = this.nodes.get(content.node_id);
          return content.content_mdx.toLocaleLowerCase().includes(keyword)
            || (node?.title ?? "").toLocaleLowerCase().includes(keyword);
        })
        .slice(0, Number(body["p_limit"] ?? 20))
        .map((content) => ({
          excerpt: content.excerpt,
          node_id: content.node_id,
        }));

      return jsonResponse({ hits, status: "ok" });
    }

    if (name === "search_memos_hybrid") {
      const excluded = new Set(
        (body["p_exclude_node_ids"] as string[] | undefined) ?? [],
      );
      const source = body["p_source_node_id"] as string | null | undefined;
      const hits = searchable
        .filter((content) =>
          content.node_id !== source && !excluded.has(content.node_id))
        .slice(0, Number(body["p_limit"] ?? 12))
        .map((content, index) => ({
          excerpt: content.excerpt,
          matched_channels: ["structural"],
          node_id: content.node_id,
          rank: index + 1,
          revision: this.nodes.get(content.node_id)?.revision ?? 1,
          title: this.nodes.get(content.node_id)?.title ?? "",
        }));

      return jsonResponse({ hits, status: "ok" });
    }

    throw new Error(`Unexpected rpc: ${name}`);
  }

  /** 与 api/supabase/memo-naming.sql 的 memo_title_norm 同语义 */
  private normalizeTitle(title: string): string {
    return title.trim().replace(/\s+/gu, " ").toLowerCase();
  }

  /*
   * 忠实复刻 memo_nodes_sibling_title_key / memo_nodes_root_title_key 两条
   * partial 唯一索引：同 user、同 parent、同 node_type、规范化标题相同即冲突，
   * 已软删的行被排除。mock 不做宽松处理，否则测不出"重名"这条真实边界。
   */
  private titleTaken(candidate: {
    id?: string;
    node_type: string;
    parent_id: string | null;
    title: string;
    user_id: string;
  }): boolean {
    const normalized = this.normalizeTitle(candidate.title);

    return [...this.nodes.values()].some((node) =>
      node.id !== candidate.id
      && node.deleted_at === null
      && node.user_id === candidate.user_id
      && node.parent_id === candidate.parent_id
      && node.node_type === candidate.node_type
      && this.normalizeTitle(node.title) === normalized);
  }

  /** PostgREST 把 SQLSTATE 原样放在 code 里，api 靠它认出结构性拒绝 */
  private uniqueViolation(): Response {
    return jsonResponse(
      {
        code: "23505",
        details: null,
        hint: null,
        message:
          'duplicate key value violates unique constraint "memo_nodes_sibling_title_key"',
      },
      409,
    );
  }

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

      if (this.titleTaken(input)) {
        return this.uniqueViolation();
      }

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

      if (
        typeof input["title"] === "string"
        && this.titleTaken({ ...updated, title: input["title"] })
      ) {
        return this.uniqueViolation();
      }

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

export const authenticatedRequest = (
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
