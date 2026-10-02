/**
 * [INPUT]: 依赖服务端返回的精确积分数与 Intl 数字格式
 * [OUTPUT]: 对外提供 formatCreditAmount：整数不带零尾，最多一位小数，正余额不足 0.1 显示阈值
 * [POS]: locale 的积分展示纯策略；只裁剪显示精度，不换算 Token、不参与扣费或额度判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function formatCreditAmount(credits: number, locale = "zh-CN"): string {
  if (!Number.isFinite(credits) || credits < 0) return "—";
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (credits > 0 && credits < 0.1) return `<${formatter.format(0.1)}`;
  // 向下保留一位，避免将 9.99 显示成未消耗的 10；尾差只修正二进制浮点边界。
  return formatter.format(Math.floor(credits * 10 + Number.EPSILON * Math.max(1, credits * 10)) / 10);
}
