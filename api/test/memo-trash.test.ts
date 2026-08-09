/**
 * [INPUT]: 依赖 Bun test、真实 Hono app 与内存 Supabase Auth/PostgREST/RPC 删除事务模拟器
 * [OUTPUT]: 覆盖删除批次、顶层 Trash、active 隔离、恢复边界、级联永久删除、当前用户清空、错误稳定性
 * [POS]: api/test 的回收站 HTTP 全链路回归测试，以单次 RPC 模拟原子事务且不连接远端或保存真实凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { MemoContent, MemoNode } from "../src/model/memo.model.ts";

const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "profile-test-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-09T08:00:00.000Z";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const M = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

const { app } = await import("../src/app.ts");

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const node = (
  id: string,
  type: "folder" | "memo",
  parentId: string | null = null,
  userId = USER_ID,
  sortOrder = 1000,
): MemoNode => ({
  id,
  user_id: userId,
  parent_id: parentId,
  node_type: type,
  title: id,
  sort_order: sortOrder,
  icon: null,
  color: null,
  metadata: {},
  deleted_at: null,
  deleted_root_id: null,
  created_at: NOW,
  updated_at: NOW,
});

const content = (nodeId: string, userId = USER_ID): MemoContent => ({
  node_id: nodeId,
  user_id: userId,
  content_mdx: `正文:${nodeId}`,
  excerpt: `摘要:${nodeId}`,
  word_count: 1,
  metadata: {},
  created_at: NOW,
  updated_at: NOW,
});

type RpcBody = { p_node_id?: string; p_user_id: string };

class TrashSupabaseMock {
  readonly nodes = new Map<string, MemoNode>();
  readonly contents = new Map<string, MemoContent>();
  readonly failRpc: boolean;

  constructor(failRpc = false) {
    this.failRpc = failRpc;
  }

  private childrenOf(parentId: string): MemoNode[] {
    return [...this.nodes.values()].filter((candidate) =>
      candidate.parent_id === parentId);
  }

  private subtreeIds(rootId: string): Set<string> {
    const ids = new Set<string>();
    const pending = [rootId];

    while (pending.length > 0) {
      const id = pending.pop();

      if (id === undefined || ids.has(id)) {
        continue;
      }

      ids.add(id);
      pending.push(...this.childrenOf(id).map((child) => child.id));
    }

    return ids;
  }

  private hasDeletedAncestor(target: MemoNode): boolean {
    let parentId = target.parent_id;

    while (parentId !== null) {
      const parent = this.nodes.get(parentId);

      if (parent === undefined) {
        return false;
      }

      if (parent.deleted_at !== null) {
        return true;
      }

      parentId = parent.parent_id;
    }

    return false;
  }

  private removeSubtree(rootId: string) {
    for (const id of this.subtreeIds(rootId)) {
      this.nodes.delete(id);
      this.contents.delete(id);
    }
  }

  readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.pathname === "/auth/v1/user") {
      return request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`
        ? jsonResponse({ id: USER_ID, email: "trash@example.com" })
        : jsonResponse({ message: "Invalid token" }, 401);
    }

    if (
      request.headers.get("apikey") !== PUBLISHABLE_KEY ||
      request.headers.get("Authorization") !== `Bearer ${ACCESS_TOKEN}`
    ) {
      return jsonResponse({ message: "Invalid credentials" }, 401);
    }

    if (url.pathname === "/rest/v1/memo_nodes") {
      return this.handleNodes(request, url);
    }

    if (url.pathname === "/rest/v1/memos") {
      return this.handleContents(request, url);
    }

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (this.failRpc) {
        return jsonResponse({
          message: `database failed with ${ACCESS_TOKEN} and internal detail`,
        }, 500);
      }

      return this.handleRpc(url.pathname.split("/").at(-1) ?? "", await request.json() as RpcBody);
    }

    throw new Error(`Unexpected path: ${url.pathname}`);
  };

  private async handleNodes(request: Request, url: URL): Promise<Response> {
    const userId = url.searchParams.get("user_id")?.slice(3) ?? "";

    if (request.method === "GET") {
      let rows = [...this.nodes.values()].filter((item) => item.user_id === userId);
      const id = url.searchParams.get("id")?.slice(3);

      if (id !== undefined) {
        rows = rows.filter((item) => item.id === id);
      }

      if (url.searchParams.get("deleted_at") === "is.null") {
        rows = rows.filter((item) => item.deleted_at === null);
      }

      rows.sort((left, right) =>
        left.sort_order - right.sort_order || left.id.localeCompare(right.id));
      return jsonResponse(rows);
    }

    if (request.method === "PATCH") {
      const id = url.searchParams.get("id")?.slice(3) ?? "";
      const current = this.nodes.get(id);

      if (
        current === undefined ||
        current.user_id !== userId ||
        (url.searchParams.get("deleted_at") === "is.null" && current.deleted_at !== null)
      ) {
        return jsonResponse([]);
      }

      const updated = { ...current, ...await request.json(), updated_at: NOW } as MemoNode;
      this.nodes.set(id, updated);
      return jsonResponse([updated]);
    }

    throw new Error(`Unexpected memo_nodes method: ${request.method}`);
  }

  private async handleContents(request: Request, url: URL): Promise<Response> {
    const userId = url.searchParams.get("user_id")?.slice(3) ?? "";

    if (request.method === "GET") {
      let rows = [...this.contents.values()].filter((item) => item.user_id === userId);
      const nodeId = url.searchParams.get("node_id");

      if (nodeId?.startsWith("eq.")) {
        rows = rows.filter((item) => item.node_id === nodeId.slice(3));
      } else if (nodeId?.startsWith("in.")) {
        const ids = new Set(nodeId.match(/[0-9a-f-]{36}/g) ?? []);
        rows = rows.filter((item) => ids.has(item.node_id));
      }

      if (url.searchParams.get("select") === "node_id,user_id,excerpt") {
        return jsonResponse(rows.map(({ node_id, user_id, excerpt }) => ({
          node_id,
          user_id,
          excerpt,
        })));
      }

      return jsonResponse(rows);
    }

    if (request.method === "PATCH") {
      const nodeId = url.searchParams.get("node_id")?.slice(3) ?? "";
      const current = this.contents.get(nodeId);

      if (current === undefined || current.user_id !== userId) {
        return jsonResponse([]);
      }

      const updated = { ...current, ...await request.json(), updated_at: NOW };
      this.contents.set(nodeId, updated);
      return jsonResponse([updated]);
    }

    throw new Error(`Unexpected memos method: ${request.method}`);
  }

  private handleRpc(name: string, body: RpcBody): Response {
    const nodeId = body.p_node_id ?? "";
    const target = this.nodes.get(nodeId);
    const ownedTarget = target?.user_id === body.p_user_id ? target : undefined;

    if (name === "soft_delete_memo_node") {
      if (ownedTarget === undefined) return jsonResponse({ status: "not_found" });
      if (ownedTarget.deleted_at !== null) return jsonResponse({ status: "already_deleted" });

      for (const id of this.subtreeIds(nodeId)) {
        const current = this.nodes.get(id);

        if (current?.user_id === body.p_user_id && current.deleted_at === null) {
          this.nodes.set(id, {
            ...current,
            deleted_at: NOW,
            deleted_root_id: nodeId,
          });
        }
      }

      return jsonResponse({ status: "deleted", node: this.nodes.get(nodeId) });
    }

    if (name === "restore_memo_node") {
      if (ownedTarget === undefined) return jsonResponse({ status: "not_found" });
      if (ownedTarget.deleted_at === null) return jsonResponse({ status: "already_active" });
      if (ownedTarget.deleted_root_id !== nodeId) return jsonResponse({ status: "not_root" });
      if (this.hasDeletedAncestor(ownedTarget)) {
        return jsonResponse({ status: "blocked_by_deleted_ancestor" });
      }

      const restored: MemoNode[] = [];

      for (const current of this.nodes.values()) {
        if (current.user_id === body.p_user_id && current.deleted_root_id === nodeId) {
          const active = { ...current, deleted_at: null, deleted_root_id: null };
          this.nodes.set(current.id, active);
          restored.push(active);
        }
      }

      return jsonResponse({
        status: "restored",
        nodes: restored,
        contents: restored.flatMap((item) => {
          const memo = this.contents.get(item.id);
          return memo === undefined ? [] : [memo];
        }),
      });
    }

    if (name === "permanently_delete_memo_node") {
      if (ownedTarget === undefined) return jsonResponse({ status: "not_found" });
      if (ownedTarget.deleted_at === null) return jsonResponse({ status: "active_node" });
      if (ownedTarget.deleted_root_id !== nodeId) return jsonResponse({ status: "not_root" });
      if (this.hasDeletedAncestor(ownedTarget)) {
        return jsonResponse({ status: "blocked_by_deleted_ancestor" });
      }

      this.removeSubtree(nodeId);
      return jsonResponse({ status: "deleted", deleted_count: 1 });
    }

    if (name === "empty_memo_trash") {
      const roots = [...this.nodes.values()].filter((item) =>
        item.user_id === body.p_user_id &&
        item.deleted_at !== null &&
        item.deleted_root_id === item.id);
      roots.forEach((item) => this.removeSubtree(item.id));
      return jsonResponse({ status: "emptied", deleted_count: roots.length });
    }

    throw new Error(`Unexpected RPC: ${name}`);
  }
}

const originalFetch = globalThis.fetch;
let mock: TrashSupabaseMock;

beforeEach(() => {
  mock = new TrashSupabaseMock();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const request = (path: string, init: RequestInit = {}) =>
  app.fetch(new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
  }));

const responseData = async (response: Response) => (await response.json()).data;

describe("memo trash lifecycle", () => {
  test("invalid JWT and other-user ids stay hidden", async () => {
    const invalid = await app.request("/memo-trash", {
      headers: { Authorization: "Bearer invalid" },
    });
    mock.nodes.set(M, node(M, "memo", null, OTHER_USER_ID));
    const hidden = await request(`/memo-nodes/${M}/trash`, { method: "POST" });

    expect(invalid.status).toBe(401);
    expect(hidden.status).toBe(404);
  });

  test("soft-deletes one memo, retains body, and isolates every active endpoint", async () => {
    mock.nodes.set(M, node(M, "memo"));
    mock.contents.set(M, content(M));

    expect((await request(`/memo-nodes/${M}/trash`, { method: "POST" })).status).toBe(200);
    expect(mock.contents.get(M)?.content_mdx).toBe(`正文:${M}`);
    expect((await responseData(await request("/memo-trash"))).map((item: MemoNode) => item.id)).toEqual([M]);
    expect(await responseData(await request("/memo-tree"))).toEqual([]);

    for (const response of await Promise.all([
      request(`/memos/${M}`),
      request(`/memos/${M}`, { method: "PATCH", body: JSON.stringify({ content_mdx: "x" }) }),
      request(`/memo-nodes/${M}`, { method: "PATCH", body: JSON.stringify({ title: "x" }) }),
      request(`/memo-nodes/${M}/move`, { method: "PATCH", body: JSON.stringify({ parent_id: null }) }),
    ])) {
      expect(response.status).toBe(404);
    }
  });

  test("returns only a deleted folder root and restores hierarchy, ordering, and body", async () => {
    mock.nodes.set(A, node(A, "folder", null, USER_ID, 500));
    mock.nodes.set(B, node(B, "folder", A, USER_ID, 750));
    mock.nodes.set(M, node(M, "memo", B, USER_ID, 250));
    mock.contents.set(M, content(M));

    await request(`/memo-nodes/${A}/trash`, { method: "POST" });
    const trash = await responseData(await request("/memo-trash"));
    expect(trash.map((item: MemoNode) => item.id)).toEqual([A]);

    const restored = await responseData(await request(`/memo-nodes/${A}/restore`, { method: "POST" }));
    expect(restored.children[0].id).toBe(B);
    expect(restored.children[0].children[0].sort_order).toBe(250);
    expect(restored.children[0].children[0].memo.content_mdx).toBe(`正文:${M}`);
  });

  test("keeps an earlier child batch deleted when restoring its later-deleted parent", async () => {
    mock.nodes.set(A, node(A, "folder"));
    mock.nodes.set(B, node(B, "folder", A));
    mock.nodes.set(M, node(M, "memo", B));
    mock.contents.set(M, content(M));
    await request(`/memo-nodes/${B}/trash`, { method: "POST" });
    await request(`/memo-nodes/${A}/trash`, { method: "POST" });

    expect((await responseData(await request("/memo-trash"))).map((item: MemoNode) => item.id)).toEqual([A]);
    const blocked = await request(`/memo-nodes/${B}/restore`, { method: "POST" });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("MEMO_RESTORE_BLOCKED");

    const restoredParent = await responseData(await request(`/memo-nodes/${A}/restore`, { method: "POST" }));
    expect(restoredParent.children).toEqual([]);
    expect(mock.nodes.get(B)?.deleted_root_id).toBe(B);
    expect((await responseData(await request("/memo-trash"))).map((item: MemoNode) => item.id)).toEqual([B]);
  });

  test("physically cascades a deleted folder subtree and memo bodies", async () => {
    mock.nodes.set(A, node(A, "folder"));
    mock.nodes.set(B, node(B, "folder", A));
    mock.nodes.set(M, node(M, "memo", B));
    mock.contents.set(M, content(M));
    await request(`/memo-nodes/${A}/trash`, { method: "POST" });

    expect((await request(`/memo-nodes/${A}`, { method: "DELETE" })).status).toBe(200);
    expect(mock.nodes.size).toBe(0);
    expect(mock.contents.size).toBe(0);
  });

  test("clears only the current user's trash", async () => {
    mock.nodes.set(A, { ...node(A, "folder"), deleted_at: NOW, deleted_root_id: A });
    mock.nodes.set(C, {
      ...node(C, "folder", null, OTHER_USER_ID),
      deleted_at: NOW,
      deleted_root_id: C,
    });

    const cleared = await responseData(await request("/memo-trash", { method: "DELETE" }));
    expect(cleared.deleted_count).toBe(1);
    expect(mock.nodes.has(A)).toBe(false);
    expect(mock.nodes.has(C)).toBe(true);
  });

  test("rejects active hard delete and repeated delete or restore without damage", async () => {
    mock.nodes.set(M, node(M, "memo"));
    mock.contents.set(M, content(M));
    expect((await request(`/memo-nodes/${M}`, { method: "DELETE" })).status).toBe(409);
    expect((await request(`/memo-nodes/${M}/trash`, { method: "POST" })).status).toBe(200);
    expect((await request(`/memo-nodes/${M}/trash`, { method: "POST" })).status).toBe(409);
    expect((await request(`/memo-nodes/${M}/restore`, { method: "POST" })).status).toBe(200);
    expect((await request(`/memo-nodes/${M}/restore`, { method: "POST" })).status).toBe(409);
    expect(mock.contents.has(M)).toBe(true);
  });

  test("sanitizes RPC failures without leaking credentials", async () => {
    mock = new TrashSupabaseMock(true);
    mock.nodes.set(M, node(M, "memo"));
    globalThis.fetch = mock.fetch as typeof fetch;

    const response = await request(`/memo-nodes/${M}/trash`, { method: "POST" });
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload.code).toBe("MEMO_TRASH_STORAGE_ERROR");
    expect(JSON.stringify(payload)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(payload)).not.toContain("internal detail");
  });
});
