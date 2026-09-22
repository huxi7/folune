/**
 * [INPUT]: 依赖 Router slug/历史导航、独立的博客与动态集合、LandingRailTexture 与 Blueprint 导轨
 * [OUTPUT]: 对外提供 /blog 与 /updates 的共用目录/阅读页、空集合与未知文章回退；来路返回和元信息沿现有协议，跨分区不混用内容或推荐
 * [POS]: pages 的公开文章视图；section 选择内容与文案，目录使用上下留白空轨与仅覆盖列表的波浪侧轨，标题、阅读正文与共享营销壳只有一套实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../shared/design-system/components";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { BlueprintDivider } from "../widgets/BlueprintDivider";
import { LandingRailTexture } from "../widgets/LandingRailTexture";
import { blogAuthor, blogPosts, relatedBlogPosts } from "../widgets/landingBlogData";
import { updatePosts } from "../widgets/updatePosts";

const sections = {
  blog: { path: "/blog", title: "Folune 博客", mark: "FOLUNE JOURNAL", eyebrow: "记录 · 整理 · 连接", description: "写下一点想法，让下一次思考有迹可循。", home: "/#blog", directory: "博客目录", posts: blogPosts },
  updates: { path: "/updates", title: "最新动态", mark: "FOLUNE NEWS", eyebrow: "FOLUNE 快讯", description: "产品更新、开发手记与新的想法。", home: "/", directory: "最新动态", posts: updatePosts },
};

export function BlogPage({ section = "blog" }: { section?: keyof typeof sections }) {
  const config = sections[section];
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const post = config.posts.find(item => item.slug === slug);
  const title = slug ? post?.title ?? "文章未找到" : config.title;
  const description = post?.description ?? config.description;
  const relatedPosts = post ? section === "blog" ? relatedBlogPosts(post.slug) : config.posts.filter(item => item.slug !== post.slug).slice(0, 3) : [];
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (meta) meta.content = description;
    const titleElement = document.querySelector("title");
    const previousTitle = titleElement?.textContent ?? "";
    if (titleElement) titleElement.textContent = `${title} · Folune`;
    return () => {
      if (titleElement) titleElement.textContent = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [title, description]);

  function goBack() {
    if (location.state?.fromBlog === true) navigate(-1);
    else navigate(config.path);
  }

  return <BlueprintFrame className="landing-spine blog-spine" fullBleed>
    <main id="main-content">
      {!slug ? <>
        <nav className="blog-navigation" aria-label="返回导航">
          <Link to={config.home}>← 返回首页</Link>
        </nav>
        <BlueprintDivider flush />
        <header className="blog-index-heading"><span className="blog-eyebrow">{config.eyebrow}</span><h1 tabIndex={-1}>{config.title}</h1><p>{config.description}</p></header>
        <BlueprintDivider fullBleed />
        <div className="landing-chapter blog-index-chapter">
          <div className="landing-chapter-gap" data-edge="end" aria-hidden="true"><BlueprintDivider flush /></div>
          <div className="blog-index-list">
            <LandingRailTexture variant="weave" />
            {config.posts.length === 0 ? <div className="blog-index-empty"><p>新的动态，正在酝酿。</p><span>关于 Folune 的进展，会在这里与你分享。</span></div> : null}
            {config.posts.map(item => <article key={item.slug}>
              <Link to={`${config.path}/${item.slug}`} state={{ fromBlog: true }} className="blog-index-link">
                <div className="blog-index-copy"><div className="blog-index-meta"><span className="blog-eyebrow">{item.category}</span><time dateTime={item.date}>{item.date}</time></div><h2>{item.title}</h2><p>{item.description}</p><span className="blog-read-link">阅读全文 <span aria-hidden="true">→</span></span></div>
              </Link>
            </article>)}
          </div>
          <div className="landing-chapter-gap" data-edge="start" aria-hidden="true"><BlueprintDivider flush /></div>
        </div>
        <BlueprintDivider fullBleed />
      </> : post ? <article className="blog-article">
        <div className="blog-article-prelude" aria-hidden="true" />
        <BlueprintDivider flush fullBleed />
        <header className="blog-article-heading">
          <Link className="blog-eyebrow blog-journal-mark" to={config.path}>{config.mark}</Link>
          <h1 tabIndex={-1}>{post.title}</h1>
          <p>{post.description}</p>
          <div className="blog-article-meta">
            <span className="blog-category">{post.category}</span>
            <time dateTime={post.date}>{post.date}</time>
            <span>{blogAuthor.name}</span>
          </div>
          <Button className="blog-back-button" variant="secondary" onClick={goBack}>← 返回</Button>
        </header>
        <BlueprintDivider fullBleed />
        <div className="blog-reading">
          <aside className="blog-summary" aria-label="文章导读">
            <span className="blog-eyebrow">导读</span>
            <p>{post.lead}</p>
          </aside>
          {post.sections.map((section, i) => (
            <section key={section.title} aria-labelledby={`section-${i}`}>
              <h2 id={`section-${i}`}>{section.title}</h2>
              {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {section.figure ? <figure className="blog-product-figure">
                <img src={section.figure.src} alt={section.figure.alt} width={section.figure.width} height={section.figure.height} loading="lazy" decoding="async" />
                <figcaption>{section.figure.caption}</figcaption>
              </figure> : null}
            </section>
          ))}
          <div className="blog-endmark" aria-hidden="true">◇</div>
        </div>
        <nav className="blog-related" aria-label="继续阅读">{relatedPosts.length > 0 ? <p className="blog-eyebrow">继续阅读</p> : null}{relatedPosts.map(item => <Link key={item.slug} to={`${config.path}/${item.slug}`} replace state={location.state}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}<Link to={config.path}>查看全部{section === "updates" ? "动态" : "文章"} <span aria-hidden="true">↗</span></Link></nav>
      </article> : <div className="blog-not-found"><span className="blog-eyebrow">404</span><h1 tabIndex={-1}>这篇文章还不在这里</h1><p>链接可能有误，去{config.directory}看看吧。</p><Link to={config.path}>返回{config.directory} →</Link></div>}
    </main>
  </BlueprintFrame>;
}
