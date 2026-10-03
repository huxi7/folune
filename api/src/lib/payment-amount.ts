/**
 * [INPUT]: 依赖供应商无损 JSON 的十进制文本与整数美分
 * [OUTPUT]: 提供精确 decimalUnits、usdCents 与 centsToUsd，不使用浮点金额运算
 * [POS]: 网关与数据库之间唯一金额规范化边界，拒绝精度溢出、负数与异常规模
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function decimalUnits(value: string): { units: bigint; scale: number } {
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,3}))?$/.exec(value);
  if (!match || value.length > 100) throw new Error("Invalid decimal");
  const fraction = match[2] ?? "";
  let scale = fraction.length - Number(match[3] ?? 0);
  let units = BigInt(match[1]! + fraction);
  if (Math.abs(scale) > 36) throw new Error("Decimal precision exceeded");
  if (scale < 0) {
    units *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { units, scale };
}
export function usdCents(value: string): number {
  const { units, scale } = decimalUnits(value);
  const scaled = units * 100n;
  const divisor = 10n ** BigInt(scale);
  if (scaled % divisor !== 0n || scaled / divisor > 10_000_000n)
    throw new Error("Invalid USD amount");
  return Number(scaled / divisor);
}
export function centsToUsd(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Invalid cents");
  const amount = BigInt(cents);
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}
