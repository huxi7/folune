/**
 * [INPUT]: 依赖服务端美分报价、币种与 Intl.NumberFormat
 * [OUTPUT]: 对外提供 formatSubscriptionPrice，整数省略小数、非整数最多两位
 * [POS]: 公开价格页与账户订阅页共用的金额显示；不生成报价或决定折扣
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function formatSubscriptionPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: amount % 100 === 0 ? 0 : 2 }).format(amount / 100);
}
