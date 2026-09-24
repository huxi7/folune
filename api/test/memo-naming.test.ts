/**
 * [INPUT]: 依赖 Bun test、Hono app、test/support 的内存 Supabase mock（忠实复刻两条标题唯一索引）与 service/auth 的身份缓存测试清空口
 * [OUTPUT]: 覆盖默认名最大编号分配、无逐号失败请求与并发冲突兜底、用户输入撞名只回稳定业务冲突、跨类型同名合法、标题冲突不连坐正文、根节点作用域、soft-delete 后名称可复用、来源笔记改名与默认画布同一次写入同步，以及并发只成功一个
 * [POS]: api/test 的命名边界契约测试；唯一约束的最终裁决在数据库，这里锁定 api 把 23505 翻译成 MEMO_TITLE_CONFLICT 之后的可观测行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  authenticatedRequest,
  contentFixture,
  MockSupabase,
  nodeFixture,
  NOW,
} from "./support/supabase-mock.ts";

const { app } = await import("../src/app.ts");
const { authService } = await import("../src/service/auth.service.ts");

const originalFetch = globalThis.fetch;
let mock: MockSupabase;

beforeEach(() => {
  authService.resetIdentityCacheForTests();
  mock = new MockSupabase();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("同父同类型重名", () => {
  const FOLDER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  const seedFolder = () => {
    mock.nodes.set(
      FOLDER_ID,
      nodeFixture(FOLDER_ID, { node_type: "folder", title: "系统设计" }),
    );
  };

  test("新建备忘录的默认名撞名时顺位让开，而不是让创建失败", async () => {
    seedFolder();
    mock.nodes.set(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      nodeFixture("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "未命名备忘录",
      }),
    );

    const response = await app.fetch(
      authenticatedRequest("/memos", {
        method: "POST",
        body: JSON.stringify({ parent_id: FOLDER_ID, title: "未命名备忘录" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.title).toBe("未命名备忘录 2");
  });

  test("用户亲手命名的文件夹撞名时不改名，只回稳定业务冲突", async () => {
    seedFolder();

    const response = await app.fetch(
      authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ parent_id: null, title: "  系统   设计  " }),
      }),
    );

    // 规范化后与既有 folder 同名（首尾空白 + 连续空白折叠）
    mock.nodes.set(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      nodeFixture("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", {
        node_type: "folder",
        title: "系统 设计",
      }),
    );
    const duplicate = await app.fetch(
      authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ parent_id: null, title: "系统 设计" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).code).toBe("MEMO_TITLE_CONFLICT");
  });

  test("不同类型同名合法：folder 可以和 memo 同名", async () => {
    seedFolder();
    mock.nodes.set(
      "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      nodeFixture("cccccccc-cccc-4ccc-8ccc-ccccccccccc1", {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "少则得",
      }),
    );

    const response = await app.fetch(
      authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ parent_id: FOLDER_ID, title: "少则得" }),
      }),
    );

    expect(response.status).toBe(200);
  });

  test("标题撞名不连坐正文：PATCH /memos 回 409，但新正文已落库", async () => {
    seedFolder();
    const rivalId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
    const targetId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2";
    mock.nodes.set(
      rivalId,
      nodeFixture(rivalId, {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "熵与妄作",
      }),
    );
    mock.nodes.set(
      targetId,
      nodeFixture(targetId, {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "草稿",
      }),
    );
    mock.contents.set(targetId, contentFixture(targetId));

    const response = await app.fetch(
      authenticatedRequest(`/memos/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          content_mdx: "冲突期间写下的正文",
          title: "熵与妄作",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("MEMO_TITLE_CONFLICT");
    // 正文先写、标题后写：冲突只挂起 title，用户这段文字必须已经存下来
    expect(mock.contents.get(targetId)?.content_mdx).toBe("冲突期间写下的正文");
    expect(mock.nodes.get(targetId)?.title).toBe("草稿");
  });

  test("parent_id IS NULL 的根节点同样受唯一作用域约束", async () => {
    const firstId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
    const secondId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
    mock.nodes.set(
      firstId,
      nodeFixture(firstId, { node_type: "memo", title: "牛逼" }),
    );
    mock.nodes.set(
      secondId,
      nodeFixture(secondId, { node_type: "memo", title: "牛逼 2" }),
    );

    const response = await app.fetch(
      authenticatedRequest(`/memo-nodes/${secondId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "牛逼" }),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("MEMO_TITLE_CONFLICT");
    expect(mock.nodes.get(secondId)?.title).toBe("牛逼 2");
  });

  test("soft-delete 后名称可复用：回收站里的同名不阻塞新建", async () => {
    seedFolder();
    const deletedId = "88888888-8888-4888-8888-888888888881";
    mock.nodes.set(
      deletedId,
      nodeFixture(deletedId, {
        deleted_at: NOW,
        deleted_root_id: deletedId,
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "旧名",
      }),
    );

    const response = await app.fetch(
      authenticatedRequest("/memos", {
        method: "POST",
        body: JSON.stringify({ parent_id: FOLDER_ID, title: "旧名" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    // 名字原样可用，不该被让位成「旧名 2」
    expect(payload.data.title).toBe("旧名");
  });

  test("来源笔记改名：默认画布留着自己的名字，两者从此各过各的", async () => {
    seedFolder();
    const memoId = "77777777-7777-4777-8777-777777777771";
    const defaultCanvasId = "77777777-7777-4777-8777-777777777772";
    const standaloneId = "77777777-7777-4777-8777-777777777773";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "旧笔记名",
      }),
    );
    mock.nodes.set(
      defaultCanvasId,
      nodeFixture(defaultCanvasId, {
        node_type: "canvas",
        parent_id: FOLDER_ID,
        title: "旧笔记名",
      }),
    );
    mock.nodes.set(
      standaloneId,
      nodeFixture(standaloneId, {
        node_type: "canvas",
        parent_id: FOLDER_ID,
        title: "空间草稿",
      }),
    );
    mock.canvases.set(defaultCanvasId, {
      canvas_kind: "memo_default",
      node_id: defaultCanvasId,
      origin_node_id: memoId,
      user_id: mock.nodes.get(memoId)!.user_id,
    });
    mock.canvases.set(standaloneId, {
      canvas_kind: "standalone",
      node_id: standaloneId,
      origin_node_id: null,
      user_id: mock.nodes.get(standaloneId)!.user_id,
    });

    const response = await app.fetch(
      authenticatedRequest(`/memo-nodes/${memoId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "新笔记名" }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.title).toBe("新笔记名");
    /*
     * 画布的名字是它自己的：出生那一刻抄了一份来源笔记名作初值，此后谁也不跟随
     * 谁。跟着改就是「偷偷改 Canvas」——那正是契约 4.1 明令禁止的事。血缘存在
     * origin_node_id 与画布上那张 memo_ref 卡片里，与标题无关。
     */
    expect(mock.nodes.get(defaultCanvasId)?.title).toBe("旧笔记名");
    expect(mock.nodes.get(standaloneId)?.title).toBe("空间草稿");
    // 一次 PATCH 就是一次写入：没有第二条为了同步而发的请求
    expect(mock.operations.filter((op) => op === "nodes:patch")).toHaveLength(1);
  });

  test("默认画布自己改名：改得动，且不回落成来源笔记标题", async () => {
    seedFolder();
    const memoId = "77777777-7777-4777-8777-77777777777a";
    const defaultCanvasId = "77777777-7777-4777-8777-77777777777b";
    mock.nodes.set(
      memoId,
      nodeFixture(memoId, {
        node_type: "memo",
        parent_id: FOLDER_ID,
        title: "少则得",
      }),
    );
    mock.nodes.set(
      defaultCanvasId,
      nodeFixture(defaultCanvasId, {
        node_type: "canvas",
        parent_id: FOLDER_ID,
        title: "少则得",
      }),
    );
    mock.canvases.set(defaultCanvasId, {
      canvas_kind: "memo_default",
      node_id: defaultCanvasId,
      origin_node_id: memoId,
      user_id: mock.nodes.get(memoId)!.user_id,
    });

    const response = await app.fetch(
      authenticatedRequest(`/memo-nodes/${defaultCanvasId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "少则得里那三条线索" }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.title).toBe("少则得里那三条线索");
    expect(mock.nodes.get(defaultCanvasId)?.title).toBe("少则得里那三条线索");
    // 反向也独立：给画布起名字不动来源笔记
    expect(mock.nodes.get(memoId)?.title).toBe("少则得");
  });

  test("并发提交同一个用户命名：只有一个成功，另一个拿到稳定冲突", async () => {
    const [first, second] = await Promise.all([
      app.fetch(authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ parent_id: null, title: "并发目录" }),
      })),
      app.fetch(authenticatedRequest("/memo-folders", {
        method: "POST",
        body: JSON.stringify({ parent_id: null, title: "并发目录" }),
      })),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 409]);
    expect(
      [...mock.nodes.values()].filter((node) => node.title === "并发目录"),
    ).toHaveLength(1);
  });
});

test("默认名直接取现存最大编号加一，超过 20 篇也只尝试一次插入", async () => {
  for (let index = 2; index <= 35; index++) {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
    mock.nodes.set(id, nodeFixture(id, { title: `未命名备忘录 ${index}`, node_type: "memo" }));
  }
  const response = await app.fetch(authenticatedRequest("/memos", {
    method: "POST", body: JSON.stringify({ parent_id: null, title: "未命名备忘录" }),
  }));
  expect(response.status).toBe(200);
  expect((await response.json()).data.title).toBe("未命名备忘录 36");
  expect(mock.operations.filter(op => op === "nodes:post")).toHaveLength(1);
});

test("已占号客户端直接创建，两个客户端撞号只在冲突后跳到最大编号", async () => {
  const create = () => app.fetch(authenticatedRequest("/memos", {
    method: "POST", body: JSON.stringify({ parent_id: null, title: "未命名备忘录 3", sort_order: 1000 }),
  }));
  const results = await Promise.all([create(), create()]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  const titles = await Promise.all(results.map(async result => (await result.json()).data.title));
  expect(titles.sort()).toEqual(["未命名备忘录 3", "未命名备忘录 4"]);
});
