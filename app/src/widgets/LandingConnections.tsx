/**
 * [INPUT]: 依赖 NotePaper 共享纸面；引文与关系依据取自已保存的「卡片笔记法 ↔ 散步时的灵感」
 * [OUTPUT]: 对外提供无需操作即可阅读的 LandingConnections 关联构图
 * [POS]: Landing 功能网格与细节之间的单次发现；仅呈现静态公开材料，不装配画布或业务会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { NotePaper } from "./NotePaper";

export function LandingConnections() {
  return <section id="workflow" className="landing-connections" aria-labelledby="landing-connections-title">
    <header className="landing-section-heading">
      <div>
        <h2 id="landing-connections-title">让旧笔记，接上新思路。</h2>
        <p>在画布中选中笔记，让 AI 寻找相关记录，看见它们之间的联系。</p>
      </div>
    </header>
    <div className="landing-connection-study">
      <svg className="landing-connection-thread" viewBox="0 0 1024 280" preserveAspectRatio="none" aria-hidden="true">
        <path d="M389 112 C485 112 530 180 659 180" />
      </svg>
      <NotePaper variant="showcase" title="卡片笔记法" className="landing-connection-source">
        <p>一张卡片，只留下一个可以继续展开的想法。</p>
        <p>写作不是从白纸开始，而是从已有的卡片之间，找到一条可以走下去的线。</p>
      </NotePaper>
      <p className="landing-connection-reason">把阅读中的角度与日常经验放在一起，让旧想法成为写作的起点。</p>
      <NotePaper variant="showcase" title="散步时的灵感" className="landing-connection-target">
        <p>今天想到：阅读摘记和日常观察，其实可以放在同一处。一个提供新的角度，一个提供具体的经验。</p>
        <p>先把这点联系记下来，等写作时再回来展开。</p>
      </NotePaper>
    </div>
  </section>;
}
