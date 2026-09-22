/**
 * [INPUT]: 依赖 Router Link、静态精选博客内容、BlogCover 与现有作者头像
 * [OUTPUT]: 对外提供首页三列博客卡片与通往公开博客目录的入口
 * [POS]: widgets 的博客预览区；上下空轨与连续格点侧纹由 LandingSections 的章节外框持有；整卡是单一可聚焦链接，内容与阅读页同源，导航状态用于返回原位置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";
import { blogAuthor, featuredBlogPosts } from "./landingBlogData";
import { BlogCover } from "./BlogCover";

export function LandingBlog() {
  return <section id="blog" aria-labelledby="landing-blog-title">
    <header className="landing-section-heading">
      <div><h2 id="landing-blog-title">Folune 博客</h2><p>关于记录、整理，以及想法之间的联系。</p></div>
      <Link className="ds-button ds-button-secondary ds-button-size-default" to="/blog"><span className="ds-button-content">查看博客 <span aria-hidden="true">→</span></span></Link>
    </header>
    <div className="landing-blog-grid">
      {featuredBlogPosts.map(post => <article key={post.slug}>
        <Link className="blog-card-link" to={`/blog/${post.slug}`} state={{ fromBlog: true }} aria-labelledby={`card-${post.slug}`}>
          <div className="blog-card-cover"><BlogCover kind={post.cover} /></div>
          <div className="blog-card-copy">
            <span className="blog-eyebrow">{post.category}</span>
            <h3 id={`card-${post.slug}`}>{post.title}</h3>
            <p>{post.description}</p>
            <footer><span className="blog-author"><img src={blogAuthor.avatar} alt="" width="28" height="28" loading="lazy" />{blogAuthor.name}</span><time dateTime={post.date}>{post.date}</time></footer>
          </div>
        </Link>
      </article>)}
    </div>
  </section>;
}
