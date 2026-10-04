/**
 * [INPUT]: 依赖文章内容源的只读标签列表、文章次序与 blog-index.css 的四色浅底标签材质
 * [OUTPUT]: 对外提供 BlogTags 静态主题标签列表，最多四枚、按文章次序错开彩色序列，窄屏自然换行
 * [POS]: widgets 的博客元信息展示；供独立博客目录消费，不创建嵌套链接或虚假筛选动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function BlogTags({ tags, colorOffset = 0 }: { tags: readonly string[]; colorOffset?: number }) {
  return <ul className="blog-tags" aria-label="文章主题">
    {tags.slice(0, 4).map((tag, index) => <li className="blog-tag" data-tone={(colorOffset + index) % 4} key={tag}>{tag}</li>)}
  </ul>;
}
