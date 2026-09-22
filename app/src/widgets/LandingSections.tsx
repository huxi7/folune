/**
 * [INPUT]: 依赖真实 APP 功能截图、MarketingLink、LandingConnections、LandingGuides、LandingFeatureDetails、LandingBlog、LandingRailTexture、BlueprintDivider、共享 BrandMark 图字组合/独立印章与 huxi 头像
 * [OUTPUT]: 正文浮现标记交给营销壳，章节/导轨/卡片骨架静止；对外提供五项图文一一对应的 Folune 功能与整理/画布文章入口，以及真实关联展示、独立功能细节、六篇方法指南、评价占位、创作者信件和博客；评价、产品功能组、指南、精选博客各由一对上下空轨包围
 * [POS]: widgets 的营销叙事组合；LandingChapter 成对生成上下空轨，并让评价/指南/博客的一层侧纹贯穿空轨与正文，内侧横线仅落在主轨内，外侧仍共用斜纹边界；产品功能、关联展示与功能细节作为完整章节，内部不插空轨；创作者信件沿用首稿叙事，与 Laper 参考同构：问候与自我介绍各占一行，再以长短有别的段落分承初衷、打磨、AI 分寸与期待，一段只说一件事，由 huxi 个人署名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { LandingConnections } from "./LandingConnections";
import { LandingGuides } from "./LandingGuides";
import { LandingBlog } from "./LandingBlog";
import { LandingFeatureDetails } from "./LandingFeatureDetails";
import type { ReactNode } from "react";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { BrandMark } from "../shared/design-system/components";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingActions } from "./LandingHero";
import { LandingRailTexture, type RailVariant } from "./LandingRailTexture";

export function LandingSectionHeading({title,body,children}: {title:string;body:string;children?:ReactNode}) {
  return <header className="landing-section-heading"><div data-marketing-reveal><h2>{title}</h2><p>{body}</p></div><div className="landing-section-links">{children}</div></header>;
}

// ---- 侧纹覆盖整章；内侧横线止于主轨，让纹样贯穿上下空轨 ----
function LandingChapter({ children, railVariant }: { children: ReactNode; railVariant?: RailVariant }) {
  return (
    <div className="landing-chapter">
      {railVariant ? <LandingRailTexture variant={railVariant} /> : null}
      <div className="landing-chapter-gap" data-edge="end" aria-hidden="true">
        <BlueprintDivider flush fullBleed={!railVariant} />
      </div>
      {children}
      <div className="landing-chapter-gap" data-edge="start" aria-hidden="true">
        <BlueprintDivider flush fullBleed={!railVariant} />
      </div>
    </div>
  );
}

const features = [
  {
    title: "让 AI 整理笔记",
    body: "根据正文起标题、选择归档位置。整理后，一条线连起纸面与文件树，笔记去了哪里，一眼就能看见。",
    image: "organize",
    alt: "整理后的读书摘记归入写作研究，归档线连接纸面状态与文件树中的同一篇笔记",
    width: 1888, height: 1062,
  },
  {
    title: "在画布上连接想法",
    body: "把已有笔记放在同一张画布上，移动、连线，并排看见内容之间的关系。需要细节时，展开卡片就能读原文。",
    image: "canvas",
    alt: "卡片笔记法、让记录成为思考的起点和散步时的灵感三篇笔记在真实 Canvas 中相连",
    width: 2304, height: 1296,
  },
  {
    title: "在纸面上展开思路",
    body: "用标题、引用和列表写清想法。编辑与阅读随时切换，让一条随手记慢慢长成完整的文章。",
    image: "paper",
    alt: "让记录成为思考的起点在 Paper 阅读视图中呈现标题、引用、章节与列表",
    width: 1664, height: 936,
  },
  {
    title: "带着笔记问 AI",
    body: "输入 @ 选取笔记，把相关内容带进对话。围绕原文提问、梳理提纲，不必来回复制粘贴。",
    image: "references",
    alt: "AI 输入区已引用当前笔记，输入 @卡片后出现卡片笔记法候选，可将另一篇笔记加入问题",
    width: 896, height: 504,
  },
  {
    title: "从正文找回笔记",
    body: "忘了标题，也能搜记得的词。搜索同时查找标题、路径和正文，直接回到那条记录。",
    image: "search",
    alt: "搜索摘记，找到标题不含该词的两篇笔记，结果标明写作研究路径与正文命中",
    width: 1420, height: 798,
  },
];
// ---- 营销版式模拟：机构、账号与引语均为占位内容，不代表已获真实背书 ----
const studios = [
  { mark: "S", name: "拾页工作室" },
  { mark: "G", name: "格点设计" },
  { mark: "F", name: "周五内容社" },
  { mark: "K", name: "小步科技" },
  { mark: "O", name: "开卷研究室" },
  { mark: "L", name: "留白制作" },
];
const quotes = [
  { name: "@xiaozhang_notes", avatar: "xz", role: "内容编辑", studio: "拾页工作室", quote: "“写到一半冒出别的念头，我就先记一笔。不用为了几句话停下来想标题、建目录，等思路走完了，再请 AI 帮忙整理。”" },
  { name: "陈文", avatar: "陈", role: "研究员", studio: "开卷研究室", quote: "“读书摘记、零散的问题、还没成形的判断，我都想先留下来。需要的时候，再和 AI 一起梳理，把相关的笔记放进画布。", emphasis: "不用每次都从一张白纸开始。", ending: "那些以前写下的话，也能成为下一次思考的起点。”" },
  { name: "@momo_ux", avatar: "m", role: "产品设计师", studio: "格点设计", quote: "“访谈摘记和设计草稿，单看各有各的道理。把它们放到同一张画布上，连一连、补几句，才发现自己一直在琢磨同一个问题。”" },
  { name: "@zhouzhou_lab", avatar: "zz", role: "策划 / 自由撰稿人", studio: "周五内容社", quote: "“我愿意让 AI 帮忙归档，但也想知道笔记去了哪里。能看清整理后的目录，不合适还能撤销，我才敢把这一步交出去。”" },
  { name: "王磊", avatar: "王", role: "软件工程师", studio: "小步科技", quote: "“排查问题时随手记的几句话，过几天往往又会用上。记不清放在哪个文件夹，就搜正文里的关键词，接着上次的思路往下做。”" },
];
export function LandingSections(){
 return <>
  <LandingChapter railVariant="paper">
  <section className="landing-trust" id="community" aria-labelledby="landing-trust-title">
    <h2 id="landing-trust-title" data-marketing-reveal>为认真记录的个人与创作团队而做</h2>
    <ul className="landing-studio-strip" aria-label="工作室与团队">
      {studios.map(({ mark, name }) => (
        <li key={name}><span aria-hidden="true">{mark}</span>{name}</li>
      ))}
    </ul>
    <div className="landing-quotes">
      {quotes.map((q, i) => (
        <figure key={q.name} data-featured={i === 1}>
          {i === 1 ? <div className="landing-quote-brand"><BrandMark /></div> : null}
          <blockquote data-marketing-reveal>{q.quote}{q.emphasis ? <><br /><mark>{q.emphasis}</mark><br />{q.ending}</> : null}</blockquote>
          <figcaption data-marketing-reveal>
            <span className="landing-quote-avatar" aria-hidden="true">{q.avatar}</span>
            <span>{q.name}<small>{q.role}</small></span>
            <span className="landing-quote-studio">{q.studio}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  </section>
  </LandingChapter>
  <BlueprintDivider fullBleed />
  <LandingChapter>
  <section id="features" aria-label="Folune 产品功能">
    <LandingSectionHeading title="写下来，理清楚，连起来" body="从一张纸开始，让 AI 帮忙归档，在画布上接着思考。">
      <Link to="/blog/a-place-for-every-note" state={{ fromBlog: true }}>了解笔记整理 <span aria-hidden="true">→</span></Link>
      <Link className="ds-button ds-button-secondary ds-button-size-default" to="/blog/think-between-notes" state={{ fromBlog: true }}>
        <span className="ds-button-content">看看画布用法 <span aria-hidden="true">→</span></span>
      </Link>
    </LandingSectionHeading>
    <div className="landing-feature-grid">
      {features.map((feature, i) => <article key={feature.image} data-wide={i < 2}>
        <img src={`/landing-features/${feature.image}.png`} alt={feature.alt} width={feature.width} height={feature.height} loading="lazy" decoding="async" />
        <h3 data-marketing-reveal>{feature.title}</h3><p data-marketing-reveal>{feature.body}</p>
      </article>)}
    </div>
    <div className="landing-small-features">
      {[
        ["写作时自动保存", "先专心把话写完。日常编辑自动保存，需要整理时，再点一次「整理笔记」。"],
        ["卡片连着原文", "画布引用文件库里的笔记。展开阅读、进入原文编辑，不用维护两份内容。"],
        ["带走 Markdown 原文", "在纸面的更多菜单里复制或导出 Markdown，让写下的内容继续用在别处。"],
      ].map(([title, body]) => <article key={title} data-marketing-reveal><h3>{title}</h3><p>{body}</p></article>)}
    </div>
  </section>
  <BlueprintDivider fullBleed />
  <LandingConnections />
  <BlueprintDivider fullBleed />
  <LandingFeatureDetails />
  </LandingChapter>
  <BlueprintDivider fullBleed />
  <LandingChapter railVariant="weave">
  <LandingGuides />
  </LandingChapter>
  <BlueprintDivider fullBleed />
  <section className="landing-letter-section" id="resources" aria-labelledby="landing-letter-title">
    <article className="landing-letter">
      <div className="landing-letter-paper">
        <BrandMark className="landing-letter-seal" iconOnly />
        <small>一封信</small>
        <h2 id="landing-letter-title" data-marketing-reveal>一封来自创作者的信</h2>
        <p className="landing-letter-subtitle" data-marketing-reveal>致愿意在 Folune 留下想法的你</p>
        <div className="landing-letter-body">
          <p data-marketing-reveal>你好，很高兴你来到这里：</p>
          <hr />
          <p data-marketing-reveal>我是 huxi，Folune 的创作者。</p>
          <p data-marketing-reveal>做这个产品，是想解决一件很普通的事：我们记下了很多东西，却不一定能在需要时找到它们。一闪而过的念头、一段读书时的感触、一个还没想清楚的问题，写下时都有意义，后来却慢慢散在各处。如果落笔之前，还要先想好标题、目录和分类，记录就又多了一道门槛。</p>
          <p data-marketing-reveal>这就是 Folune 从一张纸开始的原因。哪怕只是一句话，哪怕暂时没有条理，也可以先写下来。做它的过程中，我反复调整纸面的留白、按钮的分寸，还有整理之后怎样让人看清笔记去了哪里。这些细节未必会被注意到，但我希望，你用起来时可以少一点犹豫。</p>
          <p data-marketing-reveal>AI 在这里，是帮你梳理内容、找到联系的伙伴。它可以分担整理的麻烦，但什么值得留下，仍然由你决定。整理的结果要看得见，不合适的操作也要能撤销。把自己的记录交给一个工具，需要这样的踏实感。</p>
          <p data-marketing-reveal>我期待的是，某一天，当你重新遇到一个问题，能找到自己曾经写下的几句话，发现那时的思考没有白费，还能接着往下走。比起催你写得更多，我更在意它能不能让你愿意再打开，继续写一点。</p>
          <p data-marketing-reveal>Folune 还在慢慢打磨。谢谢你愿意试试这个还在生长的作品。愿那些尚未成形的想法，都能先有一个落脚的地方。</p>
        </div>
        <div className="landing-signature" data-marketing-reveal>
          <img src="/brand/huxi-avatar.jpg" alt="huxi 的头像" width="32" height="32" loading="lazy" />
          <span>huxi</span>
          <small>Folune 创作者</small>
        </div>
      </div>
    </article>
  </section>
  <BlueprintDivider fullBleed />
  <LandingChapter railVariant="index">
  <LandingBlog />
  </LandingChapter>
  <BlueprintDivider fullBleed />
  <section className="landing-final-cta"><BrandMark className="landing-app-icon" iconOnly /><div data-marketing-reveal><h2>从今天，开始记录</h2><p>让想法落在纸上，让积累慢慢生长。</p></div><LandingActions /></section>
 </>;
}
