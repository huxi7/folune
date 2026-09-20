/**
 * [INPUT]: 依赖 NotePaper 共享纸面；引文与关系依据取自已保存的「卡片笔记法 ↔ 散步时的灵感」
 * [OUTPUT]: 对外提供侧栏叙述与双纸面相连的 LandingConnections；标出支持关系的原句，默认完整可读
 * [POS]: Landing 功能网格与细节之间的单次发现；仅呈现静态公开材料，不装配画布或业务会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { NotePaper } from "./NotePaper";

export function LandingConnections() {
  return <section id="workflow" className="landing-connections" aria-labelledby="landing-connections-title">
    <div className="landing-connection-intro">
      <header>
        <h2 id="landing-connections-title">让旧笔记，<br />接上新思路。</h2>
        <p>在画布中选中笔记，让 AI 找到相关记录，并说清它们为什么有关。</p>
      </header>
      <div className="landing-connection-reason">
        <h3>从一个方法，到一次实践。</h3>
        <p>把阅读中的角度与日常观察放在一起，让旧卡片成为新文章的起点。</p>
      </div>
    </div>
    <div className="landing-connection-study">
      <NotePaper variant="showcase" title="卡片笔记法" className="landing-connection-source">
        <p>笔记的价值不只在于储存，也在于让<mark>旧想法参与新的思考</mark>。用自己的话写下理解，比复制整段原文更容易发现联系。</p>
        <p>写作不是从白纸开始，而是从已有的卡片之间，找到一条可以走下去的线。</p>
      </NotePaper>
      <svg className="landing-connection-thread" viewBox="0 0 40 96" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 24C20 24 20 72 40 72" />
        <circle cx="0" cy="24" r="2" /><circle cx="40" cy="72" r="2" />
      </svg>
      <NotePaper variant="showcase" title="散步时的灵感" className="landing-connection-target">
        <p>今天想到：<mark>阅读摘记和日常观察，其实可以放在同一处</mark>。一个提供新的角度，一个提供具体的经验。</p>
        <p>先把这点联系记下来，等写作时再回来展开。</p>
      </NotePaper>
    </div>
  </section>;
}
