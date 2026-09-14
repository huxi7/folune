/**
 * [INPUT]: 依赖 BlueprintDivider、共享 BrandMark/Button、Figma 原始图像及结构化参考内容
 * [OUTPUT]: 对外提供参考分区的文案、原始符号、文字层级、分层信纸与文章时效标签；区块边界及细节网格前的分隔带复用 BlueprintDivider
 * [POS]: widgets 的营销叙事组合，采用语义布局重建阅读节奏，不复制导入稿定位树
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
  ["Parallel Agents","Run multiple threads of your favorite agents across several projects so you never leave your flow.","imgSidebarWebp"],
  ["Debugger","Built on the Debug Adapter Protocol (DAP), native support for debugging across multiple programming languages.","imgDebuggerWebp"],
  ["Agentic Editing","Folune natively supports agentic editing, enabling fluent collaboration between humans and AI.","imgAgentWebp"],
  ["Native Git Support","First-class support for staging, committing, pulling, pushing, viewing diffs, and many more Git operations.","imgGitWebp"],
  ["Edit Prediction","A tool that anticipates your next move. Powered by Zeta2, our open-weight language model.","imgEpWebp"],
];
const quotes=[
  {name:"José Valim",role:"Creator of Elixir",asset:"imgJoseValimsAvatar",quote:"“Yes! Now I can have shortcuts to run and debug tests. Ever since snippets were added, Folune has all of the features I could ask for in an editor.”"},
  {name:"Ethan Perez",role:"Adversarial Robustness Research Lead",asset:"imgEthanPerezsAvatar",quote:"“I've had my mind blown using Folune with Claude 3.5 Sonnet. I wrote up a few sentences around a research idea and Claude 3.5 Sonnet delivered a first pass in seconds. When I spotted some small mistakes, I highlighted the parts I wanted to change and shared feedback for it to fix. I was able to go from idea to running experiment code in half an hour—it was really easy and fun.”"},
  {name:"Dan Abramov",role:"React Core Team Member",asset:"imgDanAbramovsAvatar",quote:"“This is obviously a product built with love and care. I can tell it from two minutes of using it. Kudos to the team.”"},
  {name:"Matt Baker",role:"Principal Engineer",asset:"imgMattBakersAvatar",quote:"“My god it is so fast. Boot time, UI interaction, typing latency. I feel it. I knew VS Code always felt sluggish, but I didn't realize how good things could really be. I'm honestly astounded.”"},
  {name:"Mike Bostock",role:"Creator of D3.js, founder of Observable",asset:"imgMikeBostocksAvatar",quote:"“I’ve started using Folune, and I love it. Lots of subtle innovations (multibuffers, inlay hints, collaboration). Thoughtful, precise design. And the speed, the speed!”"},
];
const details=[
  ["Helix Mode","Feel at home with Helix and Vim."],["Diagnostics Multibuffer","Project-wide errors and warnings."],["Dev Containers","Consistent development environment."],["CLI","Use Folune from the command line."],["Rainbow Brackets","Easily move around deeply nested code."],["Built-in REPL","Run code interactively through Jupyter kernels."],["Syntax-aware selections","Efficiently select syntax nodes."],["Inlay Hints","Peek through your code."],
];
function SplitFeature({kind}:{kind:"ai"|"care"}){
 const ai=kind==="ai";
 return <div className="landing-split"><div className="landing-split-copy"><div><h3>{ai?"Agentic Editing":"Language Server Protocol support"}</h3><p>{ai?"Delegate work to the agent, follow their progress live and review changes with ease.":"Fully integrate your language of choice."}</p><a href="https://zed.dev/docs">Learn More ›</a></div><div className="landing-split-options">{(ai?["Edit Prediction","Inline Assistant","Any Agent, Any Tool"]:["Outline view","Text and line manipulation"]).map(t=><a href="https://zed.dev/features" key={t}>{t} <span>⌄</span></a>)}</div></div><div className="landing-split-media"><img src={assets[ai?"19-3464/imgImage1":"19-3974/imgLspWebp"]} alt={ai?"Agentic editing in Folune":"Language server support in Folune"} loading="lazy" /></div></div>;
}
export function LandingSections(){
 const avatars=Object.entries(assets).filter(([key])=>key.startsWith("19-2760/"));
 return <>
  <section className="landing-trust" id="community"><h2>Trusted by world-class developers<br />&amp; industry leading teams</h2><div className="landing-logo-strip">{["imgFrame1","imgFrame3","imgFrame5","imgFrame7","imgFrame9","imgFrame11"].map(name=><img src={assets[`19-2328/${name}`]} alt="" key={name} width="110" height="32" />)}</div><div className="landing-quotes">{quotes.map((q,i)=><figure key={q.name} data-featured={i===1}>{i===1?<img className="reference-anthropic" src={assets["19-2328/imgFrame14"]} alt="Anthropic" width="120" height="14" />:null}<blockquote>{q.quote}</blockquote><figcaption><img src={assets[`19-2328/${q.asset}`]} width="32" height="32" alt="" /><span>{q.name}<small>{q.role}</small></span></figcaption></figure>)}</div></section>
  <BlueprintDivider fullBleed />
  <section id="features"><LandingSectionHeading title="Folune Just Works" body="Incredibly powerful out of the box. And it only gets better as, every week, there's always a new version."><a href="https://zed.dev/roadmap">View Roadmap ›</a><LinkButton href="https://zed.dev/releases">View Releases</LinkButton></LandingSectionHeading><div className="landing-feature-grid">{features.map(([title,body,asset],i)=><article key={title} data-wide={i<2}><img src={assets[`19-2527/${asset}`]} alt={title} loading="lazy" /><h3>{title}</h3><p>{body}</p></article>)}</div><div className="landing-small-features">{[["Remote Development","Your machine only runs the Folune UI, while the actual codebase runs on a remote server."],["Multibuffer editing","Multibuffers compose excerpts from across the codebase in one editable surface."],["Vim-friendly","First-class modal editing via Vim bindings, including features like text objects and marks."]].map(([t,b])=><article key={t}><h3>{t}</h3><p>{b}</p></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-open-source"><h2>Open Source</h2><p>Folune is built by a global, growing, and thriving<br />community of thousands of developers.</p><div className="landing-avatar-strip" aria-hidden="true">{avatars.map(([key,src])=>key === "19-2760/imgZed" ? <BrandMark key={key} className="landing-contributor-brand" iconOnly /> : <img key={key} src={src} alt="" width="18" height="18" loading="lazy" />)}</div><dl className="landing-stats">{[["10,406","Forks"],["89,634","Stars"],["2,214","Contributors"],["490","PRs merged last month"]].map(([n,t])=><div key={t}><dt>{n}</dt><dd>{t}</dd></div>)}</dl><div className="landing-avatar-strip" aria-hidden="true">{[...avatars].reverse().map(([key,src])=>key === "19-2760/imgZed" ? <BrandMark key={key} className="landing-contributor-brand" iconOnly /> : <img key={key} src={src} alt="" width="18" height="18" loading="lazy" />)}</div></section>
  <BlueprintDivider fullBleed />
  <section id="workflow"><LandingSectionHeading title="AI that works the way you code" body="Folune doesn't lock you into one model, it gives you the fastest way to collaborate with any agent."><LinkButton>Learn about AI in Folune</LinkButton></LandingSectionHeading><SplitFeature kind="ai" /></section>
  <BlueprintDivider fullBleed />
  <section id="extensions"><LandingSectionHeading title="Growing extensions ecosystem" body="Boost your Folune experience by choosing from hundreds of extensions that broaden language support, offer different themes, and more."><a href="https://zed.dev/docs/extensions">Create Extension ›</a><LinkButton href="https://zed.dev/extensions">View All Extensions</LinkButton></LandingSectionHeading><div className="landing-extensions">{referenceExtensions.map(([title,count,body,author])=><article key={title}><header><h3>{title}</h3><span><img src={assets["19-3558/imgFrame1"]} alt="" width="12" height="12" />{count}</span></header><p>{body}</p><small><img src={assets["19-3558/imgFrame2"]} alt="" width="12" height="12" />{author}</small></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section><LandingSectionHeading title="Built with ultimate care" body="Every single feature in Folune has been designed to advance the state of the art. Anything less isn't worth building."><LinkButton>Learn More</LinkButton></LandingSectionHeading><SplitFeature kind="care" /><BlueprintDivider compact /><div className="landing-detail-grid">{details.map(([t,b])=><article key={t}><h3>{t}</h3><p>{b}</p></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-letter-section" id="resources"><article className="landing-letter"><div className="landing-letter-paper"><BrandMark className="landing-letter-seal" iconOnly /><small>A LETTER</small><h2>From the team</h2><div className="landing-letter-body"><p>Programming and the tools we use to do so are changing. As the culmination of 15 years of work developing industry-leading tools for developers like Atom, Electron, and Tree-sitter, Folune strives to be at the forefront of this transformation.</p><hr /><p>We're confident that the future of software development lies in fluent collaboration between humans and AI. Crafted from the ground up, Folune is here to make this vision a reality.</p></div><div className="landing-signature"><div>{["imgNathanSobo","imgAntonioScandurra","imgMaxBrunsfeld"].map(n=><img key={n} alt="" src={assets[`19-4121/${n}`]} width="16" height="16" loading="lazy" />)}</div><span>Folune</span><small>Nathan Sobo, Antonio Scandurra, Max Brunsfeld</small></div></div></article></section>
  <BlueprintDivider fullBleed />
  <section><LandingSectionHeading title="The latest from Folune" body="Check out recent announcements, the Folune Decoded series, and other in-depth posts about Folune behind the curtains."><LinkButton href="https://zed.dev/blog">View Blog</LinkButton></LandingSectionHeading><div className="landing-blog-grid">{[["Xanadu Was Waiting for Agents","Ted Nelson specified the docuverse sixty years ago. The technology finally…","imgXanaduWasWaitingForAgents","Nathan Sobo","September 1st, 2026"],["Introducing Delta","A multiplayer environment for coding with agents, from the creators of Folune.","imgIntroducingDelta","Nathan Sobo","August 12th, 2026"],["Sandboxing","Folune supports sandboxing to restrict what agents can do while using the…","imgSandboxing","Cameron Mcloughlin","August 5th, 2026"]].map(([t,b,img,author,date],index)=><article key={t}><img src={assets[`19-4211/${img}`]} alt="" loading="lazy" /><h3>{t}</h3><p>{b}</p><footer><span>{author}</span><div className="landing-blog-meta"><time>{date}</time>{index===0?<span className="landing-blog-newest">Newest</span>:null}</div></footer></article>)}</div></section>
  <BlueprintDivider fullBleed />
  <section className="landing-final-cta"><BrandMark className="landing-app-icon" iconOnly /><div><h2>Daily drive with Folune</h2><p>Code at the speed of thought.</p></div><LandingActions /></section>
 </>;
}
