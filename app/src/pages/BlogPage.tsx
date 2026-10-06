/**
 * [INPUT]: 依赖 Router slug/历史导航、MarketingLink、独立博客/动态集合、BlogTags、PublicArticle/usePublicPageMetadata、共享公告、BlogFrameSection/LandingRailTexture 与 Blueprint 导轨/共享 SVG 节点
 * [OUTPUT]: 对外提供 /blog 与 /updates 的共用目录/阅读页；目录按 Laper 实际结构呈现点阵刊头、紧凑文章行、彩色标签与 Truchet 侧纹，标题480ms、整行420ms/50ms错峰；不重复提供返回首页；动态为空时仅保留空框
 * [POS]: pages 的公开文章视图；目录几何与动效由 blog-index.css 隔离，正文阅读和来路返回保持 PublicArticle 契约；顶栏/页脚仍由营销壳持有，pathname 重播装饰、query/锚点不重播
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MarketingLink as Link } from "../widgets/LandingMotion/MarketingLink";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { BlueprintDivider, BlueprintPin } from "../widgets/BlueprintDivider";
import { LandingRailTexture } from "../widgets/LandingRailTexture";
import { blogAuthor, blogPosts, relatedBlogPosts } from "../widgets/landingBlogData";
import { updatePosts } from "../widgets/updatePosts";
import { PublicArticle } from "../widgets/PublicArticle";
import { BlogTags } from "../widgets/BlogTags";
import { BlogFrameSection } from "../widgets/BlogFrameSection";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";
import { usePublicPageMetadata } from "./usePublicPageMetadata";
import "../styles/blog-index.css";

const sections = {
  blog: { path: "/blog", title: "Folune 博客", mark: "FOLUNE JOURNAL", eyebrow: "FOLUNE 杂志", description: "让零散的灵感，长成自己的思想", directory: "博客目录", posts: blogPosts },
  updates: { path: "/updates", title: "最新动态", mark: "FOLUNE NEWS", eyebrow: "FOLUNE 快讯", description: "产品更新、开发手记与新的想法。", directory: "最新动态", posts: updatePosts },
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
  usePublicPageMetadata(title, description);

  function goBack() {
    if (location.state?.fromBlog === true) navigate(-1);
    else navigate(config.path);
  }

  return <BlueprintFrame key={location.pathname} className={`landing-spine blog-spine${!slug ? " blog-index-page" : ""}`} fullBleed>
    <main id="main-content">
      {!slug ? <>
        <MarketingAnnouncement />
        <div className="blog-index-content">
          <div className="blog-index-prelude" aria-hidden="true" />
          <header className="blog-index-heading">
            <BlueprintDivider flush />
            <div className="blog-index-heading-rails" aria-hidden="true">
              <span><BlueprintPin edge="start" /><BlueprintPin edge="end" /></span>
              <span><BlueprintPin edge="start" /><BlueprintPin edge="end" /></span>
            </div>
            <span className="blog-eyebrow blog-index-eyebrow">{config.eyebrow}</span>
            <h1 tabIndex={-1} data-marketing-reveal="heading">{config.title}</h1>
            <p>{config.description}</p>
            <BlueprintDivider flush />
          </header>
          <div className="blog-index-gap" aria-hidden="true" />
          <BlogFrameSection className="blog-index-list" patterned>
            <LandingRailTexture variant="truchet" reveal="after-frame" />
            <BlueprintDivider flush fullBleed />
            {config.posts.length === 0 ? <div className="blog-index-empty"><span className="sr-only">暂无动态</span></div> : null}
            {config.posts.map((item, index) => <article key={item.slug} data-marketing-reveal="row" data-marketing-order={index}>
              <Link to={`${config.path}/${item.slug}`} state={{ fromBlog: true }} className="blog-index-link">
                <div className="blog-index-copy">
                  <div className="blog-index-meta"><span className="blog-tag blog-tag-category" data-tone={index % 4}>{item.category}</span><time dateTime={item.date}>{item.date}</time></div>
                  <h2>{item.title}</h2><p>{item.description}</p>
                  <BlogTags tags={item.tags} colorOffset={index + 1} />
                </div>
              </Link>
            </article>)}
            <BlueprintDivider flush fullBleed />
          </BlogFrameSection>
          <div className="blog-index-after" aria-hidden="true" />
        </div>
      </> : post ? <PublicArticle
        article={post}
        mark={<Link className="blog-eyebrow blog-journal-mark" to={config.path} data-marketing-reveal>{config.mark}</Link>}
        metadata={<><span className="blog-tag blog-tag-category">{post.category}</span><time dateTime={post.date}>{post.date}</time><span>{blogAuthor.name}</span></>}
        onBack={goBack}
      >
        <nav className="blog-related" aria-label="继续阅读">{relatedPosts.length > 0 ? <p className="blog-eyebrow">继续阅读</p> : null}{relatedPosts.map(item => <Link key={item.slug} to={`${config.path}/${item.slug}`} replace state={location.state}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}<Link to={config.path}>查看全部{section === "updates" ? "动态" : "文章"} <span aria-hidden="true">↗</span></Link></nav>
      </PublicArticle> : <BlogFrameSection className="blog-not-found"><span className="blog-eyebrow" data-marketing-reveal>404</span><h1 tabIndex={-1} data-marketing-reveal>这篇文章还不在这里</h1><p data-marketing-reveal>链接可能有误，去{config.directory}看看吧。</p><Link to={config.path}>返回{config.directory} →</Link></BlogFrameSection>}
    </main>
  </BlueprintFrame>;
}
