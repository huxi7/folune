/**
 * [INPUT]: 依赖积分展示纯策略与 Bun 测试
 * [OUTPUT]: 验证整数/一位小数/不足最小刻度及非法值，不改写传入的真实余额
 * [POS]: locale 的计费展示边界回归，防止四舍五入伪造余额或零余额
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { formatCreditAmount } from "./credits";

test("积分整数不补零，小数向下保留一位", () => {
  for (const [value, label] of [[0, "0"], [10, "10"], [9.99, "9.9"], [9.9, "9.9"], [0.1, "0.1"], [5000, "5,000"]] as const) {
    expect(formatCreditAmount(value)).toBe(label);
    expect(formatCreditAmount(value, "en")).toBe(label);
  }
});
test("不足0.1但非零不冒充耗尽，非法值不造余额", () => {
  expect(formatCreditAmount(0.0001)).toBe("<0.1");
  expect(formatCreditAmount(0.09999)).toBe("<0.1");
  for (const value of [NaN, Infinity, -1]) expect(formatCreditAmount(value)).toBe("—");
});
