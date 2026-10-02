/**
 * [INPUT]: 依赖 locale、DS 动态偏好、会话/历史状态、助手尺寸与调用方动作、DS Button/淡换/图标
 * [OUTPUT]: 对外提供 AI Panel 唯一固定顶栏；历史接管标题及左侧返回动作
 * [POS]: AgentPanel 与 Motion 样板共用的无状态导航表面；新建为即时本地导航、不承载 loading；新建和面板收起保持固定位置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { motion } from "motion/react";
import { Button } from "../../shared/design-system/components";
import { ArrowLeftIcon, CaretDownIcon, ExpandIcon, MinusIcon, MenuIcon, NewConversationIcon } from "../../shared/design-system/icons";
import type { AssistantSize } from "../../shared/store/workspaceChromeStore";
import { fadeTransition, reducedFadeTransition } from "../../shared/design-system/motion";
import { useLocale } from "../../shared/locale";

type AgentPanelHeaderProps = {
  historyOpen: boolean;
  title: string;
  historyDisabled?: boolean;
  createDisabled?: boolean;
  onToggleHistory: () => void;
  onCreate: () => void;
  onClose?: () => void;
  assistantSize?: AssistantSize;
  onToggleSize?: () => void;
};

export function AgentPanelHeader(props: AgentPanelHeaderProps) {
  const { t } = useLocale();
  const reduced = useMotionPreference();
  const title = props.historyOpen ? t("会话历史", "Chat history") : props.title;
  return <header className="agent-panel-header">
    <div className="agent-panel-heading">
      <Button aria-label={props.historyOpen ? t("返回对话", "Back to chat") : t("会话历史", "Chat history")} aria-expanded={props.historyOpen} className="agent-panel-header-button" disabled={props.historyDisabled} icon={props.historyOpen ? ArrowLeftIcon : MenuIcon} onClick={props.onToggleHistory} size="square" variant="ghost" />
      <motion.p className="agent-panel-title" key={`${props.historyOpen}:${title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduced ? reducedFadeTransition : fadeTransition}>{title}</motion.p>
    </div>
    <div className="agent-panel-header-actions">
      <Button aria-label={t("新对话", "New chat")} className="agent-panel-header-button" disabled={props.createDisabled} icon={NewConversationIcon} onClick={props.onCreate} size="square" variant="ghost" />
      {props.onToggleSize ? <Button aria-label={props.assistantSize === "compact" ? t("放大 AI 窗口", "Expand AI window") : t("还原 AI 短窗", "Restore compact AI window")} className="agent-panel-header-button" icon={props.assistantSize === "compact" ? ExpandIcon : MinusIcon} onClick={props.onToggleSize} size="square" variant="ghost" /> : null}
      {props.onClose ? <Button aria-label={t("收起 AI 面板", "Close AI panel")} className="agent-panel-header-button" icon={CaretDownIcon} onClick={props.onClose} size="square" variant="ghost" /> : null}
    </div>
  </header>;
}
