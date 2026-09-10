/**
 * [INPUT]: 读取 memoToolPlanner.ts 源码文本
 * [OUTPUT]: 锁定纯规划内核不获得 token、DOM、Store 或网络的环境权限
 * [POS]: 取代已删除 Worker realm 的纯度门禁；planMemoTool 现在与调用方同域运行，纯度改由本门禁与显式 nodes 入参共同保证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "memoToolPlanner.ts"), "utf8");
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

describe("memo tool planner 纯度门禁", () => {
  /*
   * 规划器是模型输入变成用户文件树写操作的唯一转换点。它曾经跑在 Worker realm 里,
   * 那道墙是软的(import store 只会静默造出第二个空 store, 不会抛错), 现在由这里明说:
   * 树只能作为入参进来, 不许就地去取。
   */
  test("不导入 api client 或 Zustand store 运行时", () => {
    expect(code).not.toContain("memoTreeStore");
    expect(code).not.toContain("memoDocumentStore");
    expect(code).not.toContain('from "../../shared/api/ai"');
    expect(code).not.toContain('from "../../shared/api/client"');
    expect(code).not.toMatch(
      /import\s+\{[^}]*\}\s+from\s+"\.\.\/\.\.\/shared\/api\/memo"/,
    );
  });

  test("不引用 token、DOM、存储或网络等环境权限", () => {
    for (const forbidden of [
      "accessToken",
      "document",
      "window",
      "localStorage",
      "indexedDB",
      "fetch(",
      "getState(",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  test("树只能作为只读入参进入", () => {
    expect(code).toContain("nodes: readonly MemoTreeNode[]");
  });
});
