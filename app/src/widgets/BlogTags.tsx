/**
 * [INPUT]: 依赖文章内容源的只读标签列表与 blog.css 的统一标签材质
 * [OUTPUT]: 对外提供 BlogTags 静态主题标签列表，窄屏自然换行
 * [POS]: widgets 的博客元信息展示；供独立博客目录消费，不创建嵌套链接或虚假筛选动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function BlogTags({ tags }: { tags: readonly string[] }) {
  return <ul className="blog-tags" aria-label="文章主题">
    {tags.map(tag => <li className="blog-tag" key={tag}>{tag}</li>)}
  </ul>;
}
