/**
 * [INPUT]: 依赖 Bun test 与客户端工具 string/object 入参归一化函数
 * [OUTPUT]: 验证 AI SDK 以 JSON string 送达时可还原 object，并拒绝数组、null 与标量
 * [POS]: AgentPanel agent loop 输入适配回归测试，锁定 execute 前必须归一化的协议边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { normalizeToolInput } from "./clientTools";

describe("client tool input normalization", () => {
  test("accepts object and JSON object string", () => {
    expect(normalizeToolInput({ op: "delete" })).toEqual({ op: "delete" });
    expect(normalizeToolInput('{"op":"delete"}')).toEqual({ op: "delete" });
  });

  test("rejects non-object tool payloads", () => {
    expect(() => normalizeToolInput("[]")).toThrow("JSON object");
    expect(() => normalizeToolInput("null")).toThrow("JSON object");
    expect(() => normalizeToolInput("1")).toThrow("JSON object");
  });
});

