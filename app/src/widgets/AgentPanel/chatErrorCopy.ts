/**
 * [INPUT]: 依赖 chatFetch 错误代码与调用方 locale；只翻译界面错误，不改变服务端错误事实
 * [OUTPUT]: 提供会话错误的用户可读标题与说明，模型余额不足区别于网络/登录失败
 * [POS]: AgentPanel 错误文案边界，隔离组合根与传输细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getChatErrorCode } from "./chatFetch";
import type { Locale } from "../../shared/locale";

export function getErrorCopy(error: Error | undefined, locale: Locale = "zh-CN") {
  const t = (chinese: string, english: string) => locale === "en" ? english : chinese;
  if (error?.message === "DeepSeek API 账户余额不足，充值后才能继续使用。") return { title: t("AI 服务余额不足", "AI service balance is low"), description: t(error.message, "The AI provider account needs to be topped up before continuing.") };
  const code = getChatErrorCode(error);
  if (code === "UNAUTHORIZED") return { title: t("需要重新登录", "Please sign in again"), description: t("登录状态已失效，请重新登录后再发送消息。", "Your session has expired. Sign in again before sending a message.") };
  if (code === "AUTH_UPSTREAM_UNAVAILABLE" || code === "AUTH_UPSTREAM_ERROR") return { title: t("暂时无法验证登录状态", "Unable to verify your session"), description: t("身份服务暂时不可用，请稍后再试。", "The authentication service is unavailable. Please try again shortly.") };
  if (code === "INVALID_CHAT_REQUEST") return { title: t("消息格式无效", "Invalid message format"), description: t("当前消息格式无法发送，请刷新页面后再试。", "This message could not be sent. Refresh the page and try again.") };
  return { title: t("消息发送失败", "Message not sent"), description: t(error?.message || "请检查网络与 chat 服务状态，然后重试。", "Check your connection and try again.") };
}
