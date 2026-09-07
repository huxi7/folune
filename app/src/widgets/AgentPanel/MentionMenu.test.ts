/**
 * [INPUT]: 依赖 Bun test、React SSR、memo tree fixture 与 MentionMenu/getMentionResults
 * [OUTPUT]: 验证空 @ 候选、标题搜索、Canvas 排除、已选排除、revision 元数据及文件图标+文件名的轻量结果结构
 * [POS]: AgentPanel Prompt Bar 的 @检索与静态结构回归测试，不涉及浏览器键盘事件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { MemoTreeNode } from "../../shared/api/memo";
import { getMentionResults, MentionMenu } from "./MentionMenu";

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
    excerpt: null,
    word_count: 2,
    metadata: {},
    created_at: "2026-08-13T08:00:00.000Z",
    updated_at: "2026-08-13T08:00:00.000Z",
  },
});

const canvas = (id: string, title: string): MemoTreeNode => ({
  ...memo(id, title, 1),
  memo: null,
  node_type: "canvas",
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

  test("never exposes Canvas tree nodes as memo references", () => {
    const canvasNode = canvas(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "产品画布",
    );
    const memoNode = memo(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "产品规划",
      4,
    );

    expect(getMentionResults([canvasNode, memoNode], "", []).map((result) => result.id))
      .toEqual([memoNode.id]);
    expect(getMentionResults([canvasNode, memoNode], "产品", []).map((result) => result.id))
      .toEqual([memoNode.id]);
  });

  test("renders each result as file icon and filename only", () => {
    const html = renderToStaticMarkup(createElement(MentionMenu, {
      open: true,
      activeIndex: 0,
      onSelect: () => undefined,
      results: [{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        path: "工作 / 产品",
        revision: 4,
        title: "产品规划",
      }],
    }));

    expect(html).toContain("agent-mention-option-icon");
    expect(html).toContain("<strong>产品规划</strong>");
    expect(html).not.toContain("工作 / 产品");
    expect(html).not.toContain("v4");
    expect(html).not.toContain("agent-mention-heading");
  });
});
