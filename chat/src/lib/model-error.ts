/**
 * [INPUT]: 依赖模型 SDK 错误的 HTTP 状态与 cause 包装，不读取请求正文或凭据
 * [OUTPUT]: 提供模型错误的安全用户文案；402 明确说明余额不足，其余保留通用失败
 * [POS]: Chat 模型错误展示边界，供 Mastra 错误序列化和外层 SSE 共同使用，防止二次包装抹掉原因
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const MODEL_ERROR_MESSAGE = "AI 回复中断，请重新发送消息。";
export const MODEL_BALANCE_MESSAGE = "DeepSeek API 账户余额不足，充值后才能继续使用。";

export function modelErrorMessage(error: unknown): string {
  // 只接受应用定义的文案与结构化状态；未知上游文本可能包含请求正文和密钥。
  let current = error;
  const visited = new Set<unknown>();
  for (let depth = 0; depth < 5 && current != null && !visited.has(current); depth++) {
    visited.add(current);
    if (current === MODEL_BALANCE_MESSAGE) return MODEL_BALANCE_MESSAGE;
    if (typeof current !== "object") break;
    const record = current as { statusCode?: unknown; message?: unknown; cause?: unknown; lastError?: unknown };
    if (record.statusCode === 402 || record.message === MODEL_BALANCE_MESSAGE) return MODEL_BALANCE_MESSAGE;
    current = record.cause ?? record.lastError;
  }
  return MODEL_ERROR_MESSAGE;
}
