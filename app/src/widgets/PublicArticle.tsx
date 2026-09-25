/**
 * [INPUT]: 依赖调用页提供的正文、元信息、返回动作与尾部导航，以及 BlogFrameSection、BlueprintDivider、LandingRailTexture、共享空轨样式和 Button
 * [OUTPUT]: 对外提供 PublicArticle 阅读模板与 PublicArticleContent 内容契约；Hero/空轨立即显示，正文两侧花纹外框先现、花纹后现，空轨下沿保持无节点
 * [POS]: widgets 的公开长文呈现边界；博客、动态与独立法律页面共用排版，不拥有内容集合、路由或账号状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ReactNode } from "react";
import { Button } from "../shared/design-system/components";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingRailTexture } from "./LandingRailTexture";
import { BlogFrameSection } from "./BlogFrameSection";

export type PublicArticleContent = {
  title: string;
  description: string;
  lead: string;
  sections: {
    title: string;
    paragraphs: ReactNode[];
    figure?: { src: string; alt: string; caption: string; width: number; height: number };
  }[];
};

export function PublicArticle({ article, mark, metadata, onBack, children }: {
  article: PublicArticleContent;
  mark: ReactNode;
  metadata: ReactNode;
  onBack: () => void;
  children: ReactNode;
}) {
  return <article className="blog-article">
    <BlogFrameSection>
      <div className="blog-article-prelude" aria-hidden="true" />
      <BlueprintDivider flush fullBleed />
      <header className="blog-article-heading">
        {mark}
        <h1 tabIndex={-1} data-marketing-reveal>{article.title}</h1>
        <p data-marketing-reveal>{article.description}</p>
        <div className="blog-article-meta" data-marketing-reveal>{metadata}</div>
        <Button className="blog-back-button" variant="secondary" onClick={onBack}>← 返回</Button>
      </header>
      <BlueprintDivider fullBleed />
      <div className="landing-chapter-gap" data-edge="end" aria-hidden="true"><BlueprintDivider flush showPins={false} /></div>
    </BlogFrameSection>
    <BlogFrameSection className="blog-article-body" patterned>
      <LandingRailTexture variant="weave" reveal="after-frame" />
      <div className="blog-reading">
        <aside className="blog-summary" aria-label="文章导读">
          <span className="blog-eyebrow" data-marketing-reveal>导读</span>
          <p data-marketing-reveal>{article.lead}</p>
        </aside>
        {article.sections.map((section, i) => <section key={section.title} aria-labelledby={`section-${i}`}>
          <h2 id={`section-${i}`} data-marketing-reveal>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => <p key={index} data-marketing-reveal>{paragraph}</p>)}
          {section.figure ? <figure className="blog-product-figure">
            <img src={section.figure.src} alt={section.figure.alt} width={section.figure.width} height={section.figure.height} loading="lazy" decoding="async" />
            <figcaption>{section.figure.caption}</figcaption>
          </figure> : null}
        </section>)}
        <div className="blog-endmark" aria-hidden="true">◇</div>
      </div>
      {children}
    </BlogFrameSection>
  </article>;
}
