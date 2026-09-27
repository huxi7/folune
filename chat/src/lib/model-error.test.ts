/**
 * [INPUT]: 依赖模型错误序列化器与 SDK 风格结构化异常
 * [OUTPUT]: 验证余额不足可识别、包装不丢原因、未知异常不泄露内部数据
 * [POS]: Chat 供应商错误到安全文案的回归门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { MODEL_BALANCE_MESSAGE, MODEL_ERROR_MESSAGE, modelErrorMessage } from "./model-error";

test("402 穿过 SDK cause 和流式文案包装仍明确为余额不足", () => {
  expect(modelErrorMessage({ statusCode: 402, responseBody: "private", requestBodyValues: { secret: "hidden" } })).toBe(MODEL_BALANCE_MESSAGE);
  expect(modelErrorMessage(new Error("wrapper", { cause: { statusCode: 402 } }))).toBe(MODEL_BALANCE_MESSAGE);
  expect(modelErrorMessage({ lastError: { statusCode: 402 } })).toBe(MODEL_BALANCE_MESSAGE);
  expect(modelErrorMessage(MODEL_BALANCE_MESSAGE)).toBe(MODEL_BALANCE_MESSAGE);
  expect(modelErrorMessage(new Error(MODEL_BALANCE_MESSAGE))).toBe(MODEL_BALANCE_MESSAGE);
});

test("未知错误及循环 cause 安全回退，不输出上游原始载荷", () => {
  const circular: { cause?: unknown } = {}; circular.cause = circular;
  for (const error of [new Error("private prompt"), "private token", { statusCode: 500, responseBody: "secret" }, circular, null]) {
    expect(modelErrorMessage(error)).toBe(MODEL_ERROR_MESSAGE);
  }
});
