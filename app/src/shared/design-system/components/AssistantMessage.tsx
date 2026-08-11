/**
 * [INPUT]: 依赖 ReactNode、StreamingText 流状态、可选正文前过程槽与兼容工具 children
 * [OUTPUT]: 对外提供无可见身份标题、零卡片表面的 AssistantMessage，稳定保持处理过程在最终正文之前且不拥有折叠状态
 * [POS]: design-system AI 消息家族正文根；角色由对话布局表达，AgentPanel 决定过程/正文边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

import { StreamingText } from "./StreamingText";

type AssistantMessageProps = {
  children?: ReactNode;
  content: string;
  onProgress?: () => void;
  process?: ReactNode;
  renderContent?: (text: string) => ReactNode;
  streaming?: boolean;
};

export function AssistantMessage({
  children,
  content,
  onProgress,
  process,
  renderContent,
  streaming = false,
}: AssistantMessageProps) {
  return (
    <section
      aria-label="助手回复"
      className="ds-assistant-message"
    >
      {process}
      {content.length > 0 ? (
        <StreamingText
          onProgress={onProgress}
          renderText={renderContent}
          streaming={streaming}
          text={content}
        />
      ) : null}
      {children ? <div className="ds-assistant-tools">{children}</div> : null}
    </section>
  );
}
