/**
 * [INPUT]: 接受目录文本与用户检索词
 * [OUTPUT]: matchesReference，以同一规则匹配组件、材质与资产
 * [POS]: 独立参考页的纯检索边界；忽略大小写，多个词均须命中
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function matchesReference(text: string, query: string) {
  const content = text.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean).every(term => content.includes(term));
}
