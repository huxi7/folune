/**
 * [INPUT]: 依赖 Router slug/历史导航、静态博客文章、BlogCover 与 Blueprint 导轨
 * [OUTPUT]: 对外提供 /blog 目录、/blog/:slug 阅读页与未知文章回退；维护当前文章标题和描述
 * [POS]: pages 的公开博客内容视图；共享 MarketingLayout 顶栏，标题区以居中字标/标题/摘要/元信息/返回按钮构成独立舞台，下接导读和语义正文，无账号或业务请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../shared/design-system/components";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { BlueprintDivider } from "../widgets/BlueprintDivider";
import { BlogCover } from "../widgets/BlogCover";
import { blogAuthor, blogPosts } from "../widgets/landingBlogData";

export function BlogPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const post = blogPosts.find(item => item.slug === slug);
  const title = slug ? post?.title ?? "文章未找到" : "Folune 博客";
  const description = post?.description ?? "关于记录、整理，以及想法之间的联系。";
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
    else navigate("/blog");
  }

  return <BlueprintFrame className="landing-spine blog-spine" fullBleed>
    <main id="main-content">
      {!slug ? <>
        <div className="blog-navigation">
          <Link to="/#blog">← 返回首页</Link>
          <Link to="/blog" aria-current="page">FOLUNE JOURNAL</Link>
        </div>
        <BlueprintDivider flush fullBleed />
        <header className="blog-index-heading"><span className="blog-eyebrow">记录 · 整理 · 连接</span><h1 tabIndex={-1}>Folune 博客</h1><p>写下一点想法，让下一次思考有迹可循。</p></header>
        <BlueprintDivider fullBleed />
        <div className="blog-index-list">
          {blogPosts.map(item => <article key={item.slug}>
            <Link to={`/blog/${item.slug}`} state={{ fromBlog: true }} className="blog-index-link">
              <div className="blog-index-copy"><div className="blog-index-meta"><span className="blog-eyebrow">{item.category}</span><time dateTime={item.date}>{item.date}</time></div><h2>{item.title}</h2><p>{item.description}</p><span className="blog-read-link">阅读全文 <span aria-hidden="true">→</span></span></div>
              <BlogCover kind={item.cover} />
            </Link>
          </article>)}
        </div>
      </> : post ? <article className="blog-article">
        <div className="blog-article-prelude" aria-hidden="true" />
        <BlueprintDivider flush fullBleed />
        <header className="blog-article-heading">
          <Link className="blog-eyebrow blog-journal-mark" to="/blog">FOLUNE JOURNAL</Link>
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
            </section>
          ))}
          <div className="blog-endmark" aria-hidden="true">◇</div>
        </div>
        <nav className="blog-related" aria-label="继续阅读"><p className="blog-eyebrow">继续阅读</p>{blogPosts.filter(item => item.slug !== slug).map(item => <Link key={item.slug} to={`/blog/${item.slug}`} replace state={location.state}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}<Link to="/blog">查看全部文章 <span aria-hidden="true">↗</span></Link></nav>
      </article> : <div className="blog-not-found"><span className="blog-eyebrow">404</span><h1 tabIndex={-1}>这篇文章还不在这里</h1><p>链接可能有误，去博客目录看看其他文章吧。</p><Link to="/blog">返回博客目录 →</Link></div>}
    </main>
  </BlueprintFrame>;
}
