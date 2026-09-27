/**
 * [INPUT]: 无外部依赖，仅按字符长度估算
 * [OUTPUT]: 对外提供 estimateTokens：把一段或多段文本长度保守折算为 token 数
 * [POS]: lib 层用量估算；organize/explore/canvas 的模型调用封装在 workflow 内、拿不到精确 usage，用它保守记账使这些入口也计入每日额度
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// 中文约 1 token≈1.5 字符、英文≈4；混合内容按 /2 保守偏高估——宁可早触发限流，也不放过烧钱。
export const estimateTokens = (...texts: string[]): number => {
  const chars = texts.reduce((sum, text) => sum + text.length, 0);
  return Math.ceil(chars / 2);
};
