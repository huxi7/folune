/**
 * [INPUT]: 依赖 guidePosts 的同源文章元信息、GuideIllustration 线稿及 Router Link
 * [OUTPUT]: 对外提供分类与序号同源的紧凑六格 LandingGuides，与旧场景/扩展锚点兼容
 * [POS]: 功能细节与创作者信之间的方法目录；与信件后的精选博客独立分工，共用文章阅读协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";
import { guidePosts } from "./guidePosts";
import { GuideIllustration } from "./GuideIllustration";

export function LandingGuides() {
  return <section id="guides" className="landing-guides" aria-labelledby="landing-guides-title">
    <span id="use-cases" className="landing-legacy-anchor" aria-hidden="true" />
    <span id="extensions" className="landing-legacy-anchor" aria-hidden="true" />
    <header className="landing-guides-heading">
      <h2 id="landing-guides-title">记录与思考指南</h2>
      <p>从随手记录到组织思路，让笔记真正派上用场。</p>
    </header>
    <div className="landing-guides-grid">
      {guidePosts.map((post, index) => <article key={post.slug}>
        <Link to={`/blog/${post.slug}`} state={{ fromBlog: true }} className="landing-guide-link" aria-labelledby={`guide-${post.slug}`}>
          <div className="landing-guide-meta" aria-hidden="true">
            <span>{post.category}</span>
            <span className="landing-guide-number">{String(index + 1).padStart(2, "0")}</span>
          </div>
          <GuideIllustration kind={post.cover} />
          <div className="landing-guide-copy">
            <h3 id={`guide-${post.slug}`}>{post.title}</h3>
            <p>{post.description}</p>
          </div>
        </Link>
      </article>)}
    </div>
  </section>;
}
