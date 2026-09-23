/**
 * [INPUT]: 依赖生产 ChatMessage/Header/MentionInput、活动判定、输入判据、滚动 Hook 与 Demo 对话脚本
 * [OUTPUT]: 对外提供点击/回车共用发送、可取消、按工具脚本逐步揭示并真实归档的 Demo AI Panel
 * [POS]: 只模拟消息传输；引用保留生产 @ 图标与标题，图标按根字号同比缩放；发送不依赖 iframe 禁止的原生表单提交
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { AiCommand, FoluneUIMessage } from "../../shared/api/ai";
import { Button, MentionInput } from "../../shared/design-system/components";
import { ArrowUpIcon, AtIcon, StopIcon } from "../../shared/design-system/icons";
import { AgentPanelHeader } from "../AgentPanel/AgentPanelHeader";
import { ChatMessage, LiveAssistantTurn } from "../AgentPanel/ChatMessage";
import { deriveAssistantActivity } from "../AgentPanel/activityState";
import { canSubmitComposer, isComposerSubmitKey } from "../AgentPanel/composerBehavior";
import { useConversationScroll } from "../AgentPanel/useConversationScroll";
import { createMessages, demoTurn, materializeSteps, message, stepCommandId } from "./model";

const THINK_MS = 650;
const TOOL_MS = 420;
const STEP_GAP_MS = 200;
const CHUNK_MS = 45;
const CHUNK_CHARS = 8;
const MAX_MESSAGES = 14;
export function DemoAssistant({ memoId, title, filedAt, onClose, onHint, onOrganize, onUndo }: {
  memoId: string; title: string; filedAt: string | null; onClose: () => void; onHint: () => void;
  onOrganize: (memoId: string, commandId: string) => Promise<void>;
  onUndo: (commands: readonly AiCommand[]) => Promise<void>;
}) {
  const [messages, setMessages] = useState(createMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"ready" | "thinking" | "streaming">("ready");
  const [live, setLive] = useState<FoluneUIMessage>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const serial = useRef(0);
  const reduced = Boolean(useReducedMotion());
  const { messageListRef, scrollToLatestAuto } = useConversationScroll(messages, status, reduced, true);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const activity = deriveAssistantActivity(status === "ready" ? "ready" : "streaming", live);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    busy.current = false;
    if (live) setMessages(old => [...old, live]);
    setLive(undefined); setStatus("ready");
  };
  const send = () => {
    if (!canSubmitComposer(input, busy.current)) return;
    busy.current = true;
    const text = input.trim().slice(0, 1200), id = ++serial.current, turnId = `d${id}`;
    const steps = demoTurn(text, title, filedAt);
    // 发送那一刻的笔记身份随脚本一起冻结：回复跑到一半换笔记，写操作也必须落在原来那篇上。
    const targetId = memoId;
    const assistantId = `demo-a-${id}`;
    // 收尾正文永远是脚本最后一步；它之前的工具按序逐步揭示。
    const lastIndex = steps.length - 1;
    const turn = (parts: FoluneUIMessage["parts"]): FoluneUIMessage => ({ id: assistantId, role: "assistant", parts });
    const finish = () => { busy.current = false; setLive(undefined); setStatus("ready"); };
    const streamText = (cursor: number) => {
      const closing = steps[lastIndex];
      if (closing?.kind !== "say") { finish(); return; }
      const end = reduced ? closing.text.length : Math.min(closing.text.length, cursor + CHUNK_CHARS);
      const parts = materializeSteps(steps.slice(0, lastIndex), turnId);
      const partial = turn([...parts, { type: "text", text: closing.text.slice(0, end) }]);
      if (end >= closing.text.length) { setMessages(old => [...old, partial]); finish(); return; }
      setStatus("streaming"); setLive(partial);
      timer.current = setTimeout(() => streamText(end), CHUNK_MS);
    };
    const runStep = (index: number) => {
      if (index >= lastIndex) { setStatus("streaming"); streamText(0); return; }
      const step = steps[index]!;
      setStatus("streaming");
      setLive(turn(materializeSteps(steps.slice(0, index + 1), turnId, index)));
      timer.current = setTimeout(() => {
        // 写操作等文件树真正落定才打勾——芯片说的时刻必须就是树动的时刻。
        const settle = () => {
          setLive(turn(materializeSteps(steps.slice(0, index + 1), turnId)));
          timer.current = setTimeout(() => runStep(index + 1), STEP_GAP_MS);
        };
        if (step.kind === "move_memo") void onOrganize(targetId, stepCommandId(turnId, index)).then(settle);
        else settle();
      }, TOOL_MS);
    };
    setMessages(old => [...old.slice(-(MAX_MESSAGES - 2)), message(`demo-u-${id}`, "user", text)]);
    setInput(""); setStatus("thinking"); setLive(undefined);
    timer.current = setTimeout(() => runStep(0), THINK_MS);
  };
  return <aside aria-label="备忘录助手" className="agent-panel">
    <AgentPanelHeader title="让零散想法连起来" historyOpen={false} historyDisabled createDisabled onToggleHistory={onHint} onCreate={onHint} onClose={onClose} />
    <div className="agent-panel-body">
      <div aria-label="AI 对话" className="agent-message-list" ref={messageListRef} role="log" aria-live="polite">
        {messages.map(m => <ChatMessage key={m.id} activity="none" message={m} onUndo={onUndo} />)}
        {status !== "ready" && <LiveAssistantTurn activity={activity} message={live} onProgress={scrollToLatestAuto} onUndo={onUndo} />}
      </div>
      <div className="agent-composer">
        <div className="agent-composer-sources"><span title={title}><AtIcon aria-hidden="true" size={14} style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }} /><strong>{title}</strong></span></div>
        <MentionInput aria-label="输入消息" className="agent-chat-input" mentions={[]} value={input}
          onValueChange={value => setInput(value.slice(0,1200))} placeholder="试着问问这些笔记…"
          onKeyDown={e => { if (isComposerSubmitKey({ ...e, isComposing: e.nativeEvent.isComposing, keyCode: e.nativeEvent.keyCode })) { e.preventDefault(); send(); } }} />
        <div className="agent-composer-footer">
          {status === "ready" ? <Button aria-label="发送消息" className="agent-composer-action" disabled={!canSubmitComposer(input,false)} icon={ArrowUpIcon} onClick={send} size="square" type="button" variant="primary" />
            : <Button aria-label="停止生成" className="agent-composer-action" icon={StopIcon} onClick={stop} size="square" variant="primary" />}
        </div>
      </div>
    </div>
  </aside>;
}
