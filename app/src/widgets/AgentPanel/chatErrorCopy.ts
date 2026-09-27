/**
 * [INPUT]: 依赖 chatFetch 的错误代码归一与 SSE 安全错误文案
 * [OUTPUT]: 提供会话错误的用户可读标题与说明，模型余额不足区别于网络/登录失败
 * [POS]: AgentPanel 错误文案边界，隔离组合根与传输细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getChatErrorCode } from "./chatFetch";

export function getErrorCopy(error: Error | undefined) {
  if (error?.message === "DeepSeek API 账户余额不足，充值后才能继续使用。") return { title: "AI 服务余额不足", description: error.message };
  const code = getChatErrorCode(error);
  if (code === "UNAUTHORIZED") return { title: "需要重新登录", description: "登录状态已失效，请重新登录后再发送消息。" };
  if (code === "AUTH_UPSTREAM_UNAVAILABLE" || code === "AUTH_UPSTREAM_ERROR") return { title: "暂时无法验证登录状态", description: "身份服务暂时不可用，请稍后再试。" };
  if (code === "INVALID_CHAT_REQUEST") return { title: "消息格式无效", description: "当前消息格式无法发送，请刷新页面后再试。" };
  return { title: "消息发送失败", description: error?.message || "请检查网络与 chat 服务状态，然后重试。" };
}
