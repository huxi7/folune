/**
 * [INPUT]: 依赖 Bun test、zod JSON Schema 转换与 memo 客户端工具声明
 * [OUTPUT]: 验证 edit_node 顶层 object/无 oneOf、按 op 条件必填、禁止 operations 数组及全部客户端工具无 execute
 * [POS]: tools 子域的 DeepSeek 兼容与执行边界回归测试，防止胖工具退化为联合 schema 或服务端工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  editNodeInputSchema,
  memoClientTools,
} from "./memo";

const NODE_ID = "00000000-0000-4000-8000-000000000001";
const PARENT_ID = "00000000-0000-4000-8000-000000000002";

describe("memo client tool contracts", () => {
  test("keeps edit_node as a top-level object without oneOf", () => {
    const jsonSchema = z.toJSONSchema(editNodeInputSchema);

    expect(jsonSchema.type).toBe("object");
    expect("oneOf" in jsonSchema).toBeFalse();
    expect("anyOf" in jsonSchema).toBeFalse();
    expect(jsonSchema.properties).toHaveProperty("op");
    expect(jsonSchema.properties).not.toHaveProperty("operations");
  });

  test("enforces operation-specific fields at runtime", () => {
    expect(editNodeInputSchema.safeParse({
      node_type: "memo",
      op: "create",
      title: "读完《影响力》第三章",
    }).success).toBeTrue();
    expect(editNodeInputSchema.safeParse({
      node_id: NODE_ID,
      op: "move",
      parent_id: null,
    }).success).toBeTrue();
    expect(editNodeInputSchema.safeParse({
      node_id: NODE_ID,
      op: "reorder",
      placement: "before",
      reference_node_id: PARENT_ID,
    }).success).toBeTrue();
    expect(editNodeInputSchema.safeParse({
      node_id: NODE_ID,
      op: "move",
    }).success).toBeFalse();
    expect(editNodeInputSchema.safeParse({
      op: "create",
      operations: [],
      title: "非法 batch",
    }).success).toBeFalse();
  });

  test("declares every memo tool without server execute", () => {
    for (const tool of Object.values(memoClientTools)) {
      expect(tool.execute).toBeUndefined();
    }
  });
});

