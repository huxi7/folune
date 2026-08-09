/**
 * [INPUT]: 依赖 useMemoTreeExpansion 的纯快照解析与 folder 集合归一化工具
 * [OUTPUT]: 对外提供 localStorage 快照容错、明确全关闭、删除清理与新 folder 自动展开回归测试
 * [POS]: app/src/widgets 的文件树展开偏好测试边界，不启动 React 或浏览器即可验证持久化核心规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  parseMemoTreeExpansionSnapshot,
  reconcileExpandedFolderIds,
} from "./useMemoTreeExpansion";

describe("memo tree expansion preference", () => {
  test("distinguishes missing state from an explicitly collapsed tree", () => {
    expect(parseMemoTreeExpansionSnapshot(null)).toBeNull();
    expect(
      parseMemoTreeExpansionSnapshot('{"version":1,"expanded":[]}'),
    ).toEqual(new Set());
  });

  test("rejects malformed or incompatible snapshots", () => {
    expect(parseMemoTreeExpansionSnapshot("not-json")).toBeNull();
    expect(
      parseMemoTreeExpansionSnapshot('{"version":2,"expanded":["a"]}'),
    ).toBeNull();
    expect(
      parseMemoTreeExpansionSnapshot('{"version":1,"expanded":[1]}'),
    ).toBeNull();
  });

  test("removes deleted folders and opens newly created folders", () => {
    const reconciled = reconcileExpandedFolderIds(
      new Set(["kept", "deleted"]),
      new Set(["kept", "deleted"]),
      ["kept", "created"],
    );

    expect(reconciled).toEqual(new Set(["kept", "created"]));
  });
});
