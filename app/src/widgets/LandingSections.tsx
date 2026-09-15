/**
 * [INPUT]: 依赖 BlueprintDivider、共享 BrandMark/Button、用户提供的 huxi 头像、Figma 原始图像及结构化参考内容
 * [OUTPUT]: 对外提供中文产品叙事、明确标注的参考内容与原始符号、文字层级、分层信纸与文章时效标签；区块边界及细节网格前的分隔带复用 BlueprintDivider
 * [POS]: widgets 的营销叙事组合；创作者信件沿用首稿叙事，与 Laper 参考同构：问候与自我介绍各占一行，再以长短有别的段落分承初衷、打磨、AI 分寸与期待，一段只说一件事，由 huxi 个人署名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
const quotes=[
  {name:"José Valim",role:"Elixir 创造者",asset:"imgJoseValimsAvatar",quote:"“终于可以用快捷键运行和调试测试了。加入代码片段功能后，这款编辑器已经具备了我需要的所有功能。”"},
  {name:"Ethan Perez",role:"对抗鲁棒性研究负责人",asset:"imgEthanPerezsAvatar",quote:"“配合 Claude 3.5 Sonnet 使用时，我真的很惊喜。只写下几句研究构想，它就在几秒钟内给出了初稿。发现小问题后，我选中需要修改的部分，告诉它如何调整。从一个想法到能运行的实验代码，只用了半小时，过程轻松又有趣。”"},
  {name:"Dan Abramov",role:"React 核心团队成员",asset:"imgDanAbramovsAvatar",quote:"“这显然是一款倾注了热爱与用心的产品。用了两分钟，我就能感受到。向团队致敬。”"},
  {name:"Matt Baker",role:"首席工程师",asset:"imgMattBakersAvatar",quote:"“真的太快了。启动、界面交互、输入延迟，每个环节都能感受到。我知道 VS Code 有些迟缓，却没想到体验可以好到这种程度。确实让我惊讶。”"},
  {name:"Mike Bostock",role:"D3.js 创造者、Observable 创始人",asset:"imgMikeBostocksAvatar",quote:"“开始使用后，我就喜欢上了它。多缓冲区、内联提示、协作，还有许多细微的创新。设计周到而精确，速度更是出色。”"},
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
  <section className="landing-trust" id="community"><h2>用心打磨的工具，<br />让想法更进一步</h2><p className="landing-reference-note">以下品牌与评价来自 Zed 参考设计，译文仅用于版式展示，并非 Folune 用户背书。</p><div className="landing-logo-strip">{["imgFrame1","imgFrame3","imgFrame5","imgFrame7","imgFrame9","imgFrame11"].map(name=><img src={assets[`19-2328/${name}`]} alt="" key={name} width="110" height="32" />)}</div><div className="landing-quotes">{quotes.map((q,i)=><figure key={q.name} data-featured={i===1}>{i===1?<img className="reference-anthropic" src={assets["19-2328/imgFrame14"]} alt="Anthropic" width="120" height="14" />:null}<blockquote>{q.quote}</blockquote><figcaption><img src={assets[`19-2328/${q.asset}`]} width="32" height="32" alt="" /><span>{q.name}<small>{q.role}</small></span></figcaption></figure>)}</div></section>
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
  <section><LandingSectionHeading title="阅读与灵感" body="以下文章来自 Zed 参考设计，保留内容卡片与阅读节奏，后续逐步替换为 Folune 的产品动态。"><LinkButton href="https://zed.dev/blog">参考博客</LinkButton></LandingSectionHeading><div className="landing-blog-grid">{[["Xanadu 一直在等待智能体","六十年前，Ted Nelson 描绘了文档宇宙。如今，技术终于……","imgXanaduWasWaitingForAgents","Nathan Sobo","2026年9月1日"],["认识 Delta","来自参考团队的多人智能体编程环境。","imgIntroducingDelta","Nathan Sobo","2026年8月12日"],["沙箱机制","通过沙箱限制智能体的操作范围，让执行边界更加清晰……","imgSandboxing","Cameron Mcloughlin","2026年8月5日"]].map(([t,b,img,author,date],index)=><article key={t}><img src={assets[`19-4211/${img}`]} alt="" loading="lazy" /><h3>{t}</h3><p>{b}</p><footer><span>{author}</span><div className="landing-blog-meta"><time>{date}</time>{index===0?<span className="landing-blog-newest">最新</span>:null}</div></footer></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-final-cta"><BrandMark className="landing-app-icon" iconOnly /><div><h2>从今天，开始记录</h2><p>让想法落在纸上，让积累慢慢生长。</p></div><LandingActions /></section>
 </>;
}
