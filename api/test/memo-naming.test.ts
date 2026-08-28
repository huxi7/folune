/**
 * [INPUT]: 依赖 Bun test、Hono app 与 test/support 的内存 Supabase mock（忠实复刻两条标题唯一索引）
 * [OUTPUT]: 覆盖默认名撞名顺位让开、用户输入撞名只回稳定业务冲突、跨类型同名合法、标题冲突不连坐正文、根节点作用域、soft-delete 后名称可复用与并发只成功一个
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

const originalFetch = globalThis.fetch;
let mock: MockSupabase;

beforeEach(() => {
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
