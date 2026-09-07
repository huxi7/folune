/**
 * [INPUT]: 依赖 DS 实时动态偏好、生产 AgentPanelHeader、PersistentView、Composer class 与 DS contentEntranceVariants
 * [OUTPUT]: 对外提供 Panel 历史/对话与新上下文输入区的无网络交互样板
 * [POS]: Design System 的 Panel Motion 验收单元，直接复用生产规则，草稿仅存在示例组件本地
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AgentPanelHeader } from "../AgentPanel/AgentPanelHeader";
import { useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { motion } from "motion/react";
import { Button, PersistentView } from "../../shared/design-system/components";
import { contentEntranceVariants } from "../../shared/design-system/motion";

function SampleConversation() {
  const [draft, setDraft] = useState("");
  const reduced = Boolean(useMotionPreference());
  return <div className="agent-panel-body">
    <div className="agent-message-list"><p>输入区锚在底部，查看历史再返回会保留这份草稿。</p></div>
    <motion.form className="agent-composer" initial="hidden" animate="visible" variants={contentEntranceVariants(reduced)} onSubmit={(event) => event.preventDefault()}>
      <textarea aria-label="Panel 示例草稿" className="agent-chat-input" placeholder="写一点草稿，再切换历史试试…" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <div className="agent-composer-footer"><span>本地演示</span><Button disabled={!draft.trim()} variant="ghost">发送</Button></div>
    </motion.form>
  </div>;
}

export function PanelMotionSpecimen() {
  const [history, setHistory] = useState(false);
  const [generation, setGeneration] = useState(0);
  const newConversation = () => { setGeneration((value) => value + 1); setHistory(false); };
  return <section className="motion-specimen-section">
    <h3>Panel 内视图与新会话</h3>
    <div className="motion-specimen-conversation">
      <AgentPanelHeader historyOpen={history} title="示例对话" onToggleHistory={() => setHistory(!history)} onCreate={newConversation} />
      <div className="agent-panel-view-stack">
        <PersistentView active={history} motion="from-left" fill className="agent-panel-view-switch">
          <div className="agent-history">
            {['产品讨论', '阅读摘记', '写作思路'].map((title) => <div className="agent-thread-row" key={title}><button className="agent-thread-select" onClick={newConversation} type="button"><strong>{title}</strong><span>示例会话</span></button></div>)}
          </div>
        </PersistentView>
        <PersistentView active={!history} fill className="agent-panel-view-switch"><SampleConversation key={generation} /></PersistentView>
      </div>
    </div>
  </section>;
}
