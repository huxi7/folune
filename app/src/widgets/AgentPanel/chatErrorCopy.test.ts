/**
 * [INPUT]: 依赖 HTTP/SSE 错误文案适配与真实 ChatRequestError
 * [OUTPUT]: 验证余额不足不误导成网络故障，原有登录和未知错误不回退
 * [POS]: AgentPanel 错误呈现的纯契约测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { getErrorCopy } from "./chatErrorCopy";
import { ChatRequestError } from "./chatFetch";

test("SSE 余额错误显示服务余额不足，不建议反复重发", () => {
  expect(getErrorCopy(new Error("DeepSeek API 账户余额不足，充值后才能继续使用。"))).toEqual({
    title: "AI 服务余额不足", description: "DeepSeek API 账户余额不足，充值后才能继续使用。",
  });
});

test("登录失败与一般流式错误保留原有分类", () => {
  expect(getErrorCopy(new ChatRequestError("UNAUTHORIZED", "401")).title).toBe("需要重新登录");
  expect(getErrorCopy(new Error("AI 回复中断，请重新发送消息。"))).toEqual({ title: "消息发送失败", description: "AI 回复中断，请重新发送消息。" });
});
