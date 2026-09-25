/**
 * [INPUT]: 依赖 Router slug/历史导航、MarketingLink、独立博客/动态集合、PublicArticle/usePublicPageMetadata、BlogFrameSection、LandingRailTexture 与 Blueprint 导轨；正文由营销壳编排浮现
 * [OUTPUT]: 对外提供 /blog 与 /updates 的共用目录/阅读页及回退；目录整行是单一链接，无重复阅读按钮；仅花纹顶部两段横线和外侧竖线先现，再显现花纹，pathname 重播、query/锚点不重播
 * [POS]: pages 的公开文章视图；section 选择内容与文案，目录和正文的 Hero 后空轨上沿带节点、下沿平直，边界横线延伸到两侧外轨，侧纹只覆盖内容，标题与共享营销壳只有一套实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MarketingLink as Link } from "../widgets/LandingMotion/MarketingLink";
import { supportsMarketingTransition } from "../widgets/LandingMotion/useMarketingMotion";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { BlueprintDivider } from "../widgets/BlueprintDivider";
import { LandingRailTexture } from "../widgets/LandingRailTexture";
import { blogAuthor, blogPosts, relatedBlogPosts } from "../widgets/landingBlogData";
import { updatePosts } from "../widgets/updatePosts";
import { PublicArticle } from "../widgets/PublicArticle";
import { BlogFrameSection } from "../widgets/BlogFrameSection";
import { usePublicPageMetadata } from "./usePublicPageMetadata";

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
  usePublicPageMetadata(title, description);

  function goBack() {
    if (location.state?.fromBlog === true) navigate(-1);
    else navigate(config.path, { viewTransition: supportsMarketingTransition() });
  }

  return <BlueprintFrame key={location.pathname} className="landing-spine blog-spine" fullBleed>
    <main id="main-content">
      {!slug ? <>
        <BlogFrameSection>
          <nav className="blog-navigation" aria-label="返回导航">
            <Link to={config.home}>← 返回首页</Link>
          </nav>
          <BlueprintDivider flush />
          <header className="blog-index-heading"><span className="blog-eyebrow" data-marketing-reveal>{config.eyebrow}</span><h1 tabIndex={-1} data-marketing-reveal>{config.title}</h1><p data-marketing-reveal>{config.description}</p></header>
          <BlueprintDivider fullBleed />
          <div className="landing-chapter-gap" data-edge="end" aria-hidden="true"><BlueprintDivider flush showPins={false} /></div>
        </BlogFrameSection>
        <BlogFrameSection className="blog-index-list" patterned>
          <LandingRailTexture variant="weave" reveal="after-frame" />
          {config.posts.length === 0 ? <div className="blog-index-empty" data-marketing-reveal><p>新的动态，正在酝酿。</p><span>关于 Folune 的进展，会在这里与你分享。</span></div> : null}
          {config.posts.map(item => <article key={item.slug}>
            <Link to={`${config.path}/${item.slug}`} state={{ fromBlog: true }} className="blog-index-link">
              <div className="blog-index-copy" data-marketing-reveal><div className="blog-index-meta"><span className="blog-eyebrow">{item.category}</span><time dateTime={item.date}>{item.date}</time></div><h2>{item.title}</h2><p>{item.description}</p></div>
            </Link>
          </article>)}
        </BlogFrameSection>
        <BlogFrameSection>
          <div className="landing-chapter-gap" data-edge="start" aria-hidden="true"><BlueprintDivider flush fullBleed /></div>
          <BlueprintDivider fullBleed />
        </BlogFrameSection>
      </> : post ? <PublicArticle
        article={post}
        mark={<Link className="blog-eyebrow blog-journal-mark" to={config.path} data-marketing-reveal>{config.mark}</Link>}
        metadata={<><span className="blog-category">{post.category}</span><time dateTime={post.date}>{post.date}</time><span>{blogAuthor.name}</span></>}
        onBack={goBack}
      >
        <nav className="blog-related" aria-label="继续阅读">{relatedPosts.length > 0 ? <p className="blog-eyebrow">继续阅读</p> : null}{relatedPosts.map(item => <Link key={item.slug} to={`${config.path}/${item.slug}`} replace state={location.state}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}<Link to={config.path}>查看全部{section === "updates" ? "动态" : "文章"} <span aria-hidden="true">↗</span></Link></nav>
      </PublicArticle> : <BlogFrameSection className="blog-not-found"><span className="blog-eyebrow" data-marketing-reveal>404</span><h1 tabIndex={-1} data-marketing-reveal>这篇文章还不在这里</h1><p data-marketing-reveal>链接可能有误，去{config.directory}看看吧。</p><Link to={config.path}>返回{config.directory} →</Link></BlogFrameSection>}
    </main>
  </BlueprintFrame>;
}
