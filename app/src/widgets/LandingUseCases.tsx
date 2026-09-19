/**
 * [INPUT]: 依赖作者拟写的三组材料与产出示例、Landing 既有文字与导轨样式
 * [OUTPUT]: 对外提供灵感记录、学习摘记、项目思考三个静态场景及旧扩展锚点兼容
 * [POS]: 功能细节之后、创作者信之前的用途说明；呈现材料如何继续使用，不模拟产品操作或用户证言
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const useCases = [
  {
    name: "灵感记录", title: "留下那句来不及展开的话",
    description: "散步时冒出的想法，先记一两句。准备写作时，再找回这些记录，接着展开。",
    source: "随手记", notes: ["散步时想到：有些话，写下来之后才知道自己想说什么。"],
    result: "接着写", outcome: "我常常不是想清楚了才写。先留下一句，才慢慢看见问题。",
  },
  {
    name: "学习摘记", title: "让读过的内容变成自己的理解",
    description: "摘下重要的话，也写下自己的疑问。把几篇相关笔记放到一起比较，慢慢形成自己的判断。",
    source: "摘记与疑问", notes: ["读完后，试着合上书，用自己的话复述。", "记住原句，和真正理解有什么区别？"],
    result: "我的理解", outcome: "原句是线索。能解释、举例，再联系自己的经历，才是我真正带走的部分。",
  },
  {
    name: "项目思考", title: "把散落的想法变成下一步",
    description: "把观察、问题和方案放进同一张画布，比较它们的联系，再回到笔记写清下一步。",
    source: "两条观察", notes: ["入口里同时出现很多选项。", "我每次都只想先记一句话。"],
    result: "下一步", outcome: "先让记录入口更直接，再观察分类是否还会打断书写。",
  },
];

export function LandingUseCases() {
  return <section id="use-cases" className="landing-use-cases" aria-labelledby="landing-use-cases-title">
    <span id="extensions" className="landing-legacy-anchor" aria-hidden="true" />
    <header className="landing-section-heading">
      <div><h2 id="landing-use-cases-title">把零散记录，用在具体的事情上。</h2><p>读过的、想到的、还没想清楚的，都可以先记下来，再慢慢变成自己的理解和下一步。</p></div>
      <small className="landing-use-cases-label">内容示例</small>
    </header>
    {useCases.map(item => <article className="landing-use-case" key={item.name}>
      <div className="landing-use-case-copy"><small>{item.name}</small><h3>{item.title}</h3><p>{item.description}</p></div>
      <div className="landing-use-case-materials">
        <div className="landing-use-case-source"><small>{item.source}</small>{item.notes.map(note => <p key={note}>{note}</p>)}</div>
        <div className="landing-use-case-outcome"><small>{item.result}</small><p>{item.outcome}</p></div>
      </div>
    </article>)}
  </section>;
}
