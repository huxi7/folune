/**
 * [INPUT]: 依赖 Bun test、memo tree fixture 与 getMentionResults
 * [OUTPUT]: 验证空 @ 候选、标题搜索、已选排除、路径和 revision 输出
 * [POS]: AgentPanel Prompt Bar 的 @检索纯逻辑回归测试，不涉及 DOM 键盘事件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../../shared/api/memo";
import { getMentionResults } from "./MentionMenu";

const memo = (id: string, title: string, revision: number): MemoTreeNode => ({
  id,
  user_id: "11111111-1111-4111-8111-111111111111",
  parent_id: null,
  node_type: "memo",
  title,
  sort_order: "1000",
  icon: null,
  color: null,
  metadata: {},
  revision,
  deleted_at: null,
  deleted_root_id: null,
  created_at: "2026-08-13T08:00:00.000Z",
  updated_at: "2026-08-13T08:00:00.000Z",
  children: [],
  memo: {
    node_id: id,
    user_id: "11111111-1111-4111-8111-111111111111",
    content_mdx: "正文",
    excerpt: null,
    word_count: 2,
    metadata: {},
    created_at: "2026-08-13T08:00:00.000Z",
    updated_at: "2026-08-13T08:00:00.000Z",
  },
});

describe("Prompt Bar mention search", () => {
  test("lists memos for bare @ and preserves revision", () => {
    const results = getMentionResults([
      memo("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "产品规划", 4),
      memo("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "用户访谈", 7),
    ], "", []);
    expect(results.map((result) => [result.title, result.revision])).toEqual([
      ["产品规划", 4],
      ["用户访谈", 7],
    ]);
  });

  test("searches and excludes already selected memos", () => {
    const selected = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(getMentionResults([
      memo(selected, "产品规划", 4),
      memo("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "产品复盘", 2),
    ], "产品", [selected]).map((result) => result.title)).toEqual(["产品复盘"]);
  });
});
