/**
 * [INPUT]: 依赖 Bun test 与 memo.mapper 的无副作用 DTO 适配函数
 * [OUTPUT]: 验证 Trash 最小 DTO 和 restore subtree 的 sort_order/deleted_root_id 映射
 * [POS]: app/src/shared/api 的备忘录契约测试，不连接后端、不改写共享模块 mock
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  mapMemoTrashItemDto,
  mapMemoTreeNodeDto,
} from "./memo.mapper";

const TIME = "2026-08-09T08:00:00.000Z";

describe("memo API DTO mapping", () => {
  test("keeps the minimal trash item contract", () => {
    const item = mapMemoTrashItemDto({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      node_type: "memo",
      title: "已删除备忘录",
      parent_id: null,
      original_path: "根目录",
      deleted_at: TIME,
      excerpt: "摘要",
    });

    expect(item).toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      node_type: "memo",
      title: "已删除备忘录",
      parent_id: null,
      original_path: "根目录",
      deleted_at: TIME,
      excerpt: "摘要",
    });
  });

  test("maps restored numeric sort orders to Store string values", () => {
    const restored = mapMemoTreeNodeDto({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      user_id: "11111111-1111-4111-8111-111111111111",
      parent_id: null,
      revision: 4,
      node_type: "folder",
      title: "恢复文件夹",
      sort_order: 500.25,
      icon: null,
      color: null,
      metadata: {},
      deleted_at: null,
      deleted_root_id: null,
      created_at: TIME,
      updated_at: TIME,
      memo: null,
      children: [],
    });

    expect(restored.sort_order).toBe("500.25");
    expect(restored.deleted_root_id).toBeNull();
  });
});
