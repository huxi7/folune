/**
 * [INPUT]: 依赖 Bun test、Hono app、Web fetch 与 test/support 的内存 Supabase Auth/PostgREST mock
 * [OUTPUT]: 覆盖 memo API 的认证、轻量树/画布身份/关键词搜索、单篇正文、创建补偿、正文统计、owner 隔离、严格更新与防环移动
 * [POS]: api/test 的备忘录树 HTTP 全链路契约测试，不连接远端服务且不保存或输出真实凭据；命名与重名边界另见 memo-naming.test.ts
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  authenticatedRequest,
  contentFixture,
  MockSupabase,
  nodeFixture,
  NOW,
  OTHER_USER_ID,
  USER_ID,
} from "./support/supabase-mock.ts";

import type { MemoNode } from "../src/model/memo.model.ts";

const { app } = await import("../src/app.ts");

const originalFetch = globalThis.fetch;
let mock: MockSupabase;

beforeEach(() => {
  mock = new MockSupabase();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
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

describe("GET /memo-tree canvas identity", () => {
  test("canvas 节点带上画布身份，folder/memo 连键都不出现", async () => {
    const memoId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const defaultCanvasId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const standaloneId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    mock.nodes.set(memoId, nodeFixture(memoId, { node_type: "memo", title: "少则得" }));
    mock.contents.set(memoId, contentFixture(memoId));
    mock.nodes.set(defaultCanvasId, nodeFixture(defaultCanvasId, {
      node_type: "canvas",
      sort_order: 2000,
      title: "少则得",
    }));
    mock.nodes.set(standaloneId, nodeFixture(standaloneId, {
      node_type: "canvas",
      sort_order: 3000,
      title: "空间草稿",
    }));
    mock.canvases.set(defaultCanvasId, {
      canvas_kind: "memo_default",
      node_id: defaultCanvasId,
      origin_node_id: memoId,
      user_id: USER_ID,
    });
    mock.canvases.set(standaloneId, {
      canvas_kind: "standalone",
      node_id: standaloneId,
      origin_node_id: null,
      user_id: USER_ID,
    });

    const response = await app.fetch(authenticatedRequest("/memo-tree"));
    const payload = await response.json();
    const byId = new Map<string, Record<string, unknown>>(
      payload.data.map((node: Record<string, unknown>) => [node["id"], node]),
    );

    expect(response.status).toBe(200);
    expect(byId.get(defaultCanvasId)?.["canvas"]).toEqual({
      kind: "memo_default",
      origin_node_id: memoId,
    });
    expect(byId.get(standaloneId)?.["canvas"]).toEqual({
      kind: "standalone",
      origin_node_id: null,
    });
    // memo/folder 不携带这个键，客户端既有断言与投影不受影响
    expect(Object.keys(byId.get(memoId) ?? {})).not.toContain("canvas");
    expect(mock.operations).toContain("canvases:get");
  });

  test("没有 canvas 节点时不多发一次 canvases 请求", async () => {
    const memoId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    mock.nodes.set(memoId, nodeFixture(memoId, { node_type: "memo" }));
    mock.contents.set(memoId, contentFixture(memoId));

    await app.fetch(authenticatedRequest("/memo-tree"));

    expect(mock.operations).not.toContain("canvases:get");
  });
});

describe("GET /memo-search", () => {
  const matchingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const trashedId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  const seedSearchCorpus = (): void => {
    mock.nodes.set(matchingId, nodeFixture(matchingId, {
      node_type: "memo",
      title: "商业笔记",
    }));
    mock.contents.set(matchingId, contentFixture(matchingId, {
      content_mdx: "项目里讨论了商业模式",
      excerpt: "项目里讨论了商业模式",
    }));

    mock.nodes.set(otherId, nodeFixture(otherId, {
      node_type: "memo",
      title: "无关",
    }));
    mock.contents.set(otherId, contentFixture(otherId, {
      content_mdx: "完全无关",
      excerpt: "完全无关",
    }));
  };

  test("只返回当前用户正文命中的 ID 与摘要，不返回完整正文", async () => {
    seedSearchCorpus();

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
  });

  test("检索经 RPC 下传，且 body 只含服务端可信参数", async () => {
    seedSearchCorpus();

    await app.fetch(authenticatedRequest("/memo-search?q=%E5%95%86%E4%B8%9A&limit=10"));
    const call = mock.rpcBodies.at(-1);

    expect(call?.name).toBe("search_memos_keyword");
    expect(Object.keys(call?.body ?? {}).sort().join(",")).toBe(
      "p_limit,p_query_text,p_user_id",
    );
    expect(call?.body["p_user_id"]).toBe(USER_ID);
  });

  test("回收站里的正文不再被搜到", async () => {
    seedSearchCorpus();
    mock.nodes.set(trashedId, nodeFixture(trashedId, {
      deleted_at: NOW,
      deleted_root_id: trashedId,
      node_type: "memo",
      title: "已删除",
    }));
    mock.contents.set(trashedId, contentFixture(trashedId, {
      content_mdx: "项目里讨论了商业模式",
      excerpt: "已删除的命中",
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
  });

  test("缺少 Bearer 时不触碰任何存储", async () => {
    const response = await app.fetch(new Request(
      "http://localhost/memo-search?q=x",
    ));

    expect(response.status).toBe(401);
    expect(mock.operations).toEqual([]);
  });
});

describe("POST /memo-search/related", () => {
  test("返回带名次与命中通道的相似候选，并排除源与显式排除项", async () => {
    const sourceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const relatedId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const excludedId = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    for (const [id, title] of [
      [sourceId, "源"],
      [relatedId, "相关"],
      [excludedId, "被排除"],
    ] as const) {
      mock.nodes.set(id, nodeFixture(id, { node_type: "memo", title }));
      mock.contents.set(id, contentFixture(id, {
        content_mdx: `${title}正文`,
        excerpt: `${title}摘要`,
      }));
    }

    const response = await app.fetch(authenticatedRequest("/memo-search/related", {
      body: JSON.stringify({
        exclude_node_ids: [excludedId],
        limit: 5,
        query_text: "过度设计导致复杂度失控",
        source_node_id: sourceId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{
      excerpt: "相关摘要",
      matched_channels: ["structural"],
      node_id: relatedId,
      rank: 1,
      revision: 1,
      title: "相关",
    }]);
    expect(JSON.stringify(payload.data)).not.toContain("content_mdx");

    const call = mock.rpcBodies.at(-1);
    expect(call?.name).toBe("search_memos_hybrid");
    expect(Object.keys(call?.body ?? {}).sort().join(",")).toBe(
      "p_exclude_node_ids,p_limit,p_query_text,p_source_node_id,p_user_id",
    );
  });

  test("空查询被 DTO 拦下，不触碰存储", async () => {
    const response = await app.fetch(authenticatedRequest("/memo-search/related", {
      body: JSON.stringify({ query_text: "   " }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    // 鉴权先于 DTO 校验，故 auth:get 是合法的；此处要守的是「没有触碰任何业务数据」
    expect(mock.operations).toEqual(["auth:get"]);
    expect(mock.rpcBodies).toEqual([]);
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
