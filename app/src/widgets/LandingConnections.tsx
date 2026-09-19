/**
 * [INPUT]: 依赖真实 Canvas 拓展状态图、React 本地状态、共享 SegmentedControl 与 DS 动效 token
 * [OUTPUT]: 对外提供默认呈现关联理由、可手动切换三幅状态图的 LandingConnections
 * [POS]: Landing 中段的笔记关联证据；截图与引文来自同次真实操作，切换不运行 AI、不进入业务会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { SegmentedControl } from "../shared/design-system/components";

const stages = [
  {
    value: "select", label: "选择笔记",
    alt: "真实 Canvas 中选中卡片笔记法，卡片底部显示 AI 拓展入口，尚未发起本次拓展",
    caption: "在画布里选中「卡片笔记法」，点击 AI 拓展。",
    width: 1440, height: 900,
  },
  {
    value: "discover", label: "发现关联",
    alt: "AI 拓展结果的局部画面：卡片笔记法与读书摘记相连，摘记引用了用自己的话重写这一句",
    caption: "这次拓展找到了相关的读书摘记：把读到的话，用自己的话再写一遍。",
    width: 2880, height: 1800,
  },
  {
    value: "reason", label: "查看理由",
    alt: "展开真实 AI 关联理由：读书摘记把用自己的话写下理解落实为具体做法，两篇笔记都主张从记录间的联系开始写作",
    caption: "打开关系说明，看清这两篇笔记为什么被连在一起。",
    width: 2880, height: 1800,
  },
] as const;

export function LandingConnections() {
  const [stage, setStage] = useState<(typeof stages)[number]["value"]>("reason");
  const active = stages.find(item => item.value === stage)!;

  return <section id="workflow" className="landing-connections" aria-labelledby="landing-connections-title">
    <header className="landing-section-heading">
      <div>
        <h2 id="landing-connections-title">让旧笔记，接上新思路。</h2>
        <p>在画布中选中一篇笔记，让 AI 从已有记录中寻找相关内容。看看它们为什么相关，再沿着原文继续想。</p>
      </div>
    </header>
    <figure className="landing-connections-figure">
      <div className="landing-connections-stage">
        {stages.map(item => <picture key={item.value} data-active={stage === item.value}>
          {item.value === "reason" && <source media="(max-width: 767px)" srcSet="/landing-connections/reason-mobile.png" />}
          <img
            src={`/landing-connections/${item.value}.png`}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
            decoding="async"
            aria-hidden={stage !== item.value}
          />
        </picture>)}
      </div>
      <figcaption>
        <SegmentedControl ariaLabel="笔记关联操作示例" options={stages} value={stage} onValueChange={setStage} />
        <p className="landing-connections-caption" aria-live="polite">{active.caption}</p>
        <small>操作示例 · 画面来自一次真实 AI 拓展</small>
      </figcaption>
    </figure>
    <div className="landing-connections-reading">
      <div><small>卡片笔记法</small><p>“用自己的话写下理解，比复制整段原文更容易发现联系。”</p></div>
      <div><small>相关读书摘记</small><p>“读书时打动自己的句子，要用自己的话再写一遍。”</p></div>
      <div className="landing-connections-rationale"><small>这次的 AI 关联理由</small><p>它把“用自己的话写下理解”落实为读书摘记的具体做法，并同样主张从记录之间的联系开始写作。</p></div>
    </div>
  </section>;
}
