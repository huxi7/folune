/**
 * [INPUT]: 依赖 Bun test、轻量 MemoTreeNode fixtures 与 commandResults 排序纯函数
 * [OUTPUT]: 锁定根路径本地化不改写用户路径、六档固定排序、两种画布都独立成行、同名时笔记恒先于它的画布、画布行携带血缘、文件夹可导航，以及最近打开整档提前与稳定 tie-break
 * [POS]: app/src/widgets 的全局搜索排序门禁；排序只有这一处实现，任何组件都不得再排一遍，因此这里是唯一需要维护的排序契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../shared/api/memo";
import {
  buildCommandResults,
  normalizeCommandQuery,
  recentCommandResults,
} from "./commandResults";

const TIME = "2026-08-28T00:00:00.000Z";

const node = (
  id: string,
  title: string,
  type: "canvas" | "folder" | "memo",
  extra: Partial<MemoTreeNode> = {},
): MemoTreeNode => ({
  children: [],
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: type === "memo"
    ? {
      created_at: TIME,
      excerpt: null,
      metadata: {},
      node_id: id,
      updated_at: TIME,
      user_id: "user-1",
      word_count: 1,
    }
    : null,
  metadata: {},
  node_type: type,
  parent_id: null,
  revision: 1,
  sort_order: "1000",
  title,
  updated_at: TIME,
  user_id: "user-1",
  ...extra,
});

const tree: MemoTreeNode[] = [
  node("folder-1", "系统设计", "folder", {
    children: [
      node("memo-exact", "少则得", "memo", { parent_id: "folder-1" }),
      node("memo-prefix", "少则得多则惑", "memo", { parent_id: "folder-1" }),
      node("memo-contains", "论少则得的边界", "memo", { parent_id: "folder-1" }),
      node("canvas-default", "少则得", "canvas", {
        canvas: { kind: "memo_default", origin_node_id: "memo-exact" },
        parent_id: "folder-1",
      }),
    ],
  }),
  node("memo-body", "熵与妄作", "memo"),
  node("canvas-standalone", "空间草稿：少则得", "canvas", {
    canvas: { kind: "standalone", origin_node_id: null },
  }),
  node("folder-path", "合集少则得", "folder", {
    children: [node("memo-in-path", "边界札记", "memo", { parent_id: "folder-path" })],
  }),
];

const ids = (query: string, extra: Parameters<typeof buildCommandResults>[0] extends never ? never : Partial<Parameters<typeof buildCommandResults>[0]> = {}): string[] =>
  buildCommandResults({ query, tree, ...extra }).map((result) => result.id);

describe("Command Palette 排序", () => {
  test("本地化根目录标签不改写用户命名的同名文件夹", () => {
    const ownFolder = node("own-folder", "根目录", "folder", {
      children: [node("nested", "中文笔记", "memo")],
    });
    const translated = recentCommandResults({
      recentIds: ["root-note", "nested"],
      rootPathLabel: "Library",
      tree: [node("root-note", "原始内容", "memo"), ownFolder],
    });
    expect(translated.map((result) => result.path)).toEqual(["Library", "根目录"]);
    expect(translated.map((result) => result.title)).toEqual(["原始内容", "中文笔记"]);
  });

  test("六档顺序固定：完全匹配 → 前缀 → 最近打开 → 包含 → 正文 → 路径", () => {
    const results = buildCommandResults({
      bodyHitIds: ["memo-body"],
      query: "少则得",
      recentIds: ["memo-contains"],
      tree,
    });

    expect(results.map((result) => [result.id, result.match])).toEqual([
      ["memo-exact", "title-exact"],
      // 默认画布出生时抄了笔记标题, 因此同档同名; 本体先于派生物
      ["canvas-default", "title-exact"],
      ["memo-prefix", "title-prefix"],
      ["memo-contains", "recent"],
      // 同档内标题更短的在前
      ["folder-path", "title-contains"],
      ["canvas-standalone", "title-contains"],
      ["memo-body", "body"],
      ["memo-in-path", "path"],
    ]);
    // 正文命中只在查询确实命中正文时出现
    expect(buildCommandResults({
      bodyHitIds: ["memo-body"],
      query: "妄作",
      tree,
    }).map((result) => result.match)).toEqual(["title-contains"]);
  });

  test("两种画布都是独立结果，同名时笔记恒排在它的画布之前", () => {
    const results = buildCommandResults({ query: "少则得", tree });
    const ordered = results.map((result) => result.id);
    const at = (id: string) => results.find((result) => result.id === id);

    // 搜不到的东西等于不存在: 默认画布与独立画布一样占一行
    expect(ordered).toContain("canvas-default");
    expect(ordered).toContain("canvas-standalone");
    expect(ordered.indexOf("memo-exact"))
      .toBeLessThan(ordered.indexOf("canvas-default"));
    // 两行同名靠血缘分辨, 而不是靠把画布藏起来
    expect(at("canvas-default")?.originTitle).toBe("少则得");
    expect(at("canvas-standalone")?.originTitle).toBeNull();
    // 笔记行仍然带着 Tab 要去的那张画布, 画布行自己没有次级动作
    expect(at("memo-exact")?.defaultCanvasId).toBe("canvas-default");
    expect(at("canvas-default")?.defaultCanvasId).toBeNull();
  });

  test("文件夹可导航，路径命中排在最后一档", () => {
    const results = buildCommandResults({ query: "系统设计", tree });

    // 文件夹自己靠标题完全匹配排第一，夹内笔记只靠路径命中排在其后
    expect(results[0]).toMatchObject({ id: "folder-1", kind: "folder", match: "title-exact" });
    expect(results.slice(1).every((result) => result.match === "path")).toBe(true);
    expect(results.slice(1).map((result) => result.id).sort()).toEqual([
      "canvas-default",
      "memo-contains",
      "memo-exact",
      "memo-prefix",
    ]);
  });

  test("同档内的顺序确定：最近顺序 → 标题更短 → 字典序 → id", () => {
    const flat = [
      node("b", "记录", "memo"),
      node("a", "记录", "memo"),
      node("c", "记录本", "memo"),
    ];
    expect(buildCommandResults({ query: "记录", tree: flat })
      .map((result) => result.id)).toEqual(["a", "b", "c"]);
    // 最近打开把同档的 b 提到 a 前面
    expect(buildCommandResults({
      query: "记录",
      recentIds: ["b"],
      tree: flat,
    }).map((result) => result.id)).toEqual(["b", "a", "c"]);
  });

  test("查询规范化：首尾空白、连续空白与大小写不改变结果", () => {
    expect(normalizeCommandQuery("  少则   得 ")).toBe("少则 得");
    expect(ids("少则得")).toEqual(ids("  少则得  "));
    expect(buildCommandResults({ query: "   ", tree })).toEqual([]);
  });

  test("空查询列最近打开的笔记与两种画布，只跳过文件夹", () => {
    const results = recentCommandResults({
      recentIds: ["canvas-default", "folder-1", "canvas-standalone", "memo-exact", "ghost"],
      tree,
    });

    // 在默认画布上做了一小时事之后, 它必须是"刚打开过的东西"
    expect(results.map((result) => result.id))
      .toEqual(["canvas-default", "canvas-standalone", "memo-exact"]);
    expect(results.every((result) => result.match === "recent")).toBe(true);
  });
});
