/**
 * [INPUT]: 依赖 Bun test、memoTitleRules 纯策略与真实 MemoTreeNode 形状（含画布身份）
 * [OUTPUT]: 锁定规范化语义、同父同类型重名判据、跨类型/笔记与默认画布同名合法、根节点作用域
 * [POS]: shared/store 的命名规则门禁；只测纯函数，服务端并发下的最终真相由 api/test 与真实数据库检查分别覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../api/memo";
import {
  findMemoTitleConflict,
  memoNodeTitleTaken,
  normalizeMemoTitle,
} from "./memoTitleRules";

const TIME = "2026-08-29T00:00:00.000Z";

const node = (
  id: string,
  title: string,
  nodeType: MemoTreeNode["node_type"],
  extra: Partial<MemoTreeNode> = {},
): MemoTreeNode => ({
  children: [],
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: null,
  metadata: {},
  node_type: nodeType,
  parent_id: null,
  revision: 1,
  sort_order: "1000",
  title,
  updated_at: TIME,
  user_id: "user-1",
  ...extra,
});

const folder = node("folder-1", "系统设计", "folder", {
  children: [
    node("memo-a", "熵与妄作", "memo", { parent_id: "folder-1" }),
    node("memo-b", "少则得", "memo", { parent_id: "folder-1" }),
    node("canvas-default", "熵与妄作", "canvas", {
      canvas: { kind: "memo_default", origin_node_id: "memo-a" },
      parent_id: "folder-1",
    }),
    node("canvas-alone", "空间草稿", "canvas", {
      canvas: { kind: "standalone", origin_node_id: null },
      parent_id: "folder-1",
    }),
  ],
});

const tree: MemoTreeNode[] = [
  folder,
  node("root-memo", "牛逼", "memo"),
  node("root-memo-2", "牛逼 2", "memo"),
];

const conflictAt = (
  parentId: string | null,
  title: string,
  nodeType: MemoTreeNode["node_type"] = "memo",
  nodeId: string | null = null,
) =>
  findMemoTitleConflict({ nodeId, nodeType, nodes: tree, parentId, title });

describe("normalizeMemoTitle", () => {
  test("折叠首尾空白、连续空白与拉丁大小写", () => {
    expect(normalizeMemoTitle("  Alpha   Beta  ")).toBe("alpha beta");
    expect(normalizeMemoTitle("Alpha\tBeta\nGamma")).toBe("alpha beta gamma");
    expect(normalizeMemoTitle("少则得")).toBe("少则得");
  });

  test("中文之间的空白是内容而不是噪声，折叠后仍与无空白版本不同", () => {
    expect(normalizeMemoTitle("牛 逼")).not.toBe(normalizeMemoTitle("牛逼"));
  });
});

describe("findMemoTitleConflict", () => {
  test("同父同类型规范化同名即冲突：首尾空白被折掉", () => {
    expect(conflictAt("folder-1", "  熵与妄作 ")?.id).toBe("memo-a");
  });

  test("连续空白折叠后同名同样是冲突", () => {
    // 「牛逼    2」与既有的「牛逼 2」折叠后一致
    expect(conflictAt(null, "  牛逼    2  ")?.id).toBe("root-memo-2");
  });

  test("不同类型同名合法：folder 与 memo 互不冲突", () => {
    expect(conflictAt("folder-1", "熵与妄作", "folder")).toBeNull();
  });

  test("笔记与它的默认 Canvas 同名不冲突", () => {
    // 默认画布与来源笔记在同一目录、标题相同，二者共存
    expect(conflictAt("folder-1", "熵与妄作", "canvas", "canvas-default"))
      .toBeNull();
    expect(conflictAt("folder-1", "熵与妄作", "memo", "memo-a")).toBeNull();
  });

  test("改名到自己现在的名字不算冲突", () => {
    expect(conflictAt("folder-1", "少则得", "memo", "memo-b")).toBeNull();
  });

  test("parent_id IS NULL 的根节点自成一个作用域", () => {
    expect(conflictAt(null, "牛逼")?.id).toBe("root-memo");
    // 根目录的名字不会与文件夹内部的同名对象冲突
    expect(conflictAt(null, "熵与妄作")).toBeNull();
    // 反向同理：文件夹内不受根目录名字影响
    expect(conflictAt("folder-1", "牛逼")).toBeNull();
  });

  test("空标题与纯空白不算重名，交给必填校验", () => {
    expect(conflictAt("folder-1", "   ")).toBeNull();
  });

  test("找不到的 parent 视为没有同级，不误报冲突", () => {
    expect(conflictAt("folder-missing", "熵与妄作")).toBeNull();
  });
});

describe("memoNodeTitleTaken", () => {
  test("按节点自身的 parent 与 node_type 判定，排除自己", () => {
    const memoB = folder.children[1]!;

    expect(memoNodeTitleTaken(tree, memoB, "熵与妄作")).toBe(true);
    expect(memoNodeTitleTaken(tree, memoB, "少则得")).toBe(false);
    expect(memoNodeTitleTaken(tree, null, "熵与妄作")).toBe(false);
  });
});
