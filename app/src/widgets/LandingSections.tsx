/**
 * [INPUT]: 依赖 LandingBlog、BlueprintDivider、共享 BrandMark/Button、用户提供的 huxi 头像、虚构场景引语及其余分区的 Figma 参考素材
 * [OUTPUT]: 对外提供中文产品叙事、使用模拟机构与账号的评价版式及其余参考内容、文字层级、分层信纸与Folune 原创博客入口；区块边界及细节网格前的分隔带复用 BlueprintDivider
 * [POS]: widgets 的营销叙事组合；创作者信件沿用首稿叙事，与 Laper 参考同构：问候与自我介绍各占一行，再以长短有别的段落分承初衷、打磨、AI 分寸与期待，一段只说一件事，由 huxi 个人署名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { LandingBlog } from "./LandingBlog";
import type { ReactNode } from "react";
import { BrandMark, Button } from "../shared/design-system/components";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingActions } from "./LandingHero";
import { referenceAssets as assets, referenceExtensions } from "./landingReferenceData";

export function LandingSectionHeading({title,body,children}: {title:string;body:string;children?:ReactNode}) {
  return <header className="landing-section-heading"><div><h2>{title}</h2><p>{body}</p></div><div className="landing-section-links">{children}</div></header>;
}
const LinkButton = ({children,href="https://zed.dev/features"}:{children:ReactNode;href?:string}) => <Button variant="secondary" onClick={() => {window.location.href=href;}}>{children} ›</Button>;
const features=[
  ["多线程协作","在不同对话中梳理不同主题，让思路保持清晰。","imgSidebarWebp"],
  ["专注书写","从一条随手记开始，在简洁的纸面上逐步展开想法。","imgDebuggerWebp"],
  ["AI 协作","与 AI 讨论、改写和整理内容，把灵感变成可以继续使用的记录。","imgAgentWebp"],
  ["有序归档","让文件夹随内容自然生长，整理过的笔记也能随时找回。","imgGitWebp"],
  ["连接知识","把相关笔记放进画布，沿着联系发现新的思路。","imgEpWebp"],
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
const details=[
  ["Helix 模式","熟悉的 Helix 与 Vim 操作。"],["多缓冲区诊断","集中查看项目错误与警告。"],["开发容器","保持一致的开发环境。"],["CLI","从命令行启动编辑器。"],["彩虹括号","轻松辨认深层嵌套代码。"],["内置 REPL","通过 Jupyter 内核交互运行代码。"],["语法感知选择","高效选中语法节点。"],["内联提示","在代码中直接查看补充信息。"],
];
function SplitFeature({kind}:{kind:"ai"|"care"}){
 const ai=kind==="ai";
 return <div className="landing-split"><div className="landing-split-copy"><div><h3>{ai?"AI 协作":"语言服务器协议"}</h3><p>{ai?"把任务交给 AI，跟进处理进度，并检查修改内容。":"参考编辑器提供的语言支持。"}</p><a href="https://zed.dev/docs">了解更多 ›</a></div><div className="landing-split-options">{(ai?["连接知识","内联助手","智能体与工具"]:["大纲视图","文本与行操作"]).map(t=><a href="https://zed.dev/features" key={t}>{t} <span>⌄</span></a>)}</div></div><div className="landing-split-media"><img src={assets[ai?"19-3464/imgImage1":"19-3974/imgLspWebp"]} alt={ai?"AI 编辑参考画面":"语言服务器参考画面"} loading="lazy" /></div></div>;
}
export function LandingSections(){
 const avatars=Object.entries(assets).filter(([key])=>key.startsWith("19-2760/"));
 return <>
  <section className="landing-trust" id="community" aria-labelledby="landing-trust-title">
    <h2 id="landing-trust-title">为认真记录的个人与创作团队而做</h2>
    <ul className="landing-studio-strip" aria-label="工作室与团队">
      {studios.map(({ mark, name }) => (
        <li key={name}><span aria-hidden="true">{mark}</span>{name}</li>
      ))}
    </ul>
    <div className="landing-quotes">
      {quotes.map((q, i) => (
        <figure key={q.name} data-featured={i === 1}>
          {i === 1 ? <div className="landing-quote-brand"><BrandMark iconOnly /><span>Folune</span></div> : null}
          <blockquote>{q.quote}{q.emphasis ? <><br /><mark>{q.emphasis}</mark><br />{q.ending}</> : null}</blockquote>
          <figcaption>
            <span className="landing-quote-avatar" aria-hidden="true">{q.avatar}</span>
            <span>{q.name}<small>{q.role}</small></span>
            <span className="landing-quote-studio">{q.studio}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  </section>
  <BlueprintDivider fullBleed />
  <section id="features"><LandingSectionHeading title="记录、整理，一气呵成" body="从随手记录到有序积累，让工具顺着你的思路工作。下方图像暂沿用参考稿，后续替换为真实工作台。"><a href="https://zed.dev/roadmap">参考路线图 ›</a><LinkButton href="https://zed.dev/releases">参考更新</LinkButton></LandingSectionHeading><div className="landing-feature-grid">{features.map(([title,body,asset],i)=><article key={title} data-wide={i<2}><img src={assets[`19-2527/${asset}`]} alt={title} loading="lazy" /><h3>{title}</h3><p>{body}</p></article>)}</div><div className="landing-small-features">{[["随时记录","打开网页版，就能继续书写与整理自己的笔记。"],["笔记与画布","在文字中深入思考，在画布中看见记录之间的联系。"],["由你掌控","整理结果可以检查，已执行的整理操作也可以撤销。"]].map(([t,b])=><article key={t}><h3>{t}</h3><p>{b}</p></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-open-source"><h2>开放协作的力量</h2><p>好的工具，离不开持续的交流与打磨。<br />以下保留 Zed 参考稿的社区数据展示。</p><div className="landing-avatar-strip" aria-hidden="true">{avatars.map(([key,src])=>key === "19-2760/imgZed" ? <BrandMark key={key} className="landing-contributor-brand" iconOnly /> : <img key={key} src={src} alt="" width="18" height="18" loading="lazy" />)}</div><dl className="landing-stats">{[["10,406","分支"],["89,634","星标"],["2,214","贡献者"],["490","上月合并请求"]].map(([n,t])=><div key={t}><dt>{n}</dt><dd>{t}</dd></div>)}</dl><div className="landing-avatar-strip" aria-hidden="true">{[...avatars].reverse().map(([key,src])=>key === "19-2760/imgZed" ? <BrandMark key={key} className="landing-contributor-brand" iconOnly /> : <img key={key} src={src} alt="" width="18" height="18" loading="lazy" />)}</div></section>
  <BlueprintDivider fullBleed />
  <section id="workflow"><LandingSectionHeading title="顺着你的思路，与 AI 协作" body="提问、写作、梳理或整理笔记，把重复的工作交给 AI，把判断留给自己。"><LinkButton>查看 AI 参考</LinkButton></LandingSectionHeading><SplitFeature kind="ai" /></section>
  <BlueprintDivider fullBleed />
  <section id="extensions"><LandingSectionHeading title="更多扩展，更多可能" body="这里保留参考稿的扩展展示，呈现语言、主题与工具的丰富可能；并非 Folune 已上线的扩展商店。"><a href="https://zed.dev/docs/extensions">扩展开发参考 ›</a><LinkButton href="https://zed.dev/extensions">浏览参考扩展</LinkButton></LandingSectionHeading><div className="landing-extensions">{referenceExtensions.map(([title,count,body,author])=><article key={title}><header><h3>{title}</h3><span><img src={assets["19-3558/imgFrame1"]} alt="" width="12" height="12" />{count}</span></header><p>{body}</p><small><img src={assets["19-3558/imgFrame2"]} alt="" width="12" height="12" />{author}</small></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section><LandingSectionHeading title="细节之处，也值得用心" body="让每一次操作清楚、自然，让界面安静地服务于内容。下方暂保留参考编辑器的功能细节。"><LinkButton>了解更多</LinkButton></LandingSectionHeading><SplitFeature kind="care" /><BlueprintDivider compact /><div className="landing-detail-grid">{details.map(([t,b])=><article key={t}><h3>{t}</h3><p>{b}</p></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-letter-section" id="resources" aria-labelledby="landing-letter-title">
    <article className="landing-letter">
      <div className="landing-letter-paper">
        <BrandMark className="landing-letter-seal" iconOnly />
        <small>一封信</small>
        <h2 id="landing-letter-title">一封来自创作者的信</h2>
        <p className="landing-letter-subtitle">致愿意在 Folune 留下想法的你</p>
        <div className="landing-letter-body">
          <p>你好，很高兴你来到这里：</p>
          <hr />
          <p>我是 huxi，Folune 的创作者。</p>
          <p>做这个产品，是想解决一件很普通的事：我们记下了很多东西，却不一定能在需要时找到它们。一闪而过的念头、一段读书时的感触、一个还没想清楚的问题，写下时都有意义，后来却慢慢散在各处。如果落笔之前，还要先想好标题、目录和分类，记录就又多了一道门槛。</p>
          <p>这就是 Folune 从一张纸开始的原因。哪怕只是一句话，哪怕暂时没有条理，也可以先写下来。做它的过程中，我反复调整纸面的留白、按钮的分寸，还有整理之后怎样让人看清笔记去了哪里。这些细节未必会被注意到，但我希望，你用起来时可以少一点犹豫。</p>
          <p>AI 在这里，是帮你梳理内容、找到联系的伙伴。它可以分担整理的麻烦，但什么值得留下，仍然由你决定。整理的结果要看得见，不合适的操作也要能撤销。把自己的记录交给一个工具，需要这样的踏实感。</p>
          <p>我期待的是，某一天，当你重新遇到一个问题，能找到自己曾经写下的几句话，发现那时的思考没有白费，还能接着往下走。比起催你写得更多，我更在意它能不能让你愿意再打开，继续写一点。</p>
          <p>Folune 还在慢慢打磨。谢谢你愿意试试这个还在生长的作品。愿那些尚未成形的想法，都能先有一个落脚的地方。</p>
        </div>
        <div className="landing-signature">
          <img src="/brand/huxi-avatar.jpg" alt="huxi 的头像" width="32" height="32" loading="lazy" />
          <span>huxi</span>
          <small>Folune 创作者</small>
        </div>
      </div>
    </article>
  </section>
  <BlueprintDivider fullBleed />
  <LandingBlog />
  <BlueprintDivider fullBleed />
  <section className="landing-final-cta"><BrandMark className="landing-app-icon" iconOnly /><div><h2>从今天，开始记录</h2><p>让想法落在纸上，让积累慢慢生长。</p></div><LandingActions /></section>
 </>;
}
