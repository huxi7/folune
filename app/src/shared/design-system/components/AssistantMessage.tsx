/**
 * [INPUT]: 依赖 ReactNode、StreamingText 流状态与可选工具气泡 children
 * [OUTPUT]: 对外提供零卡片表面的 AssistantMessage，组合正文与独立工具区且不拥有 Activity Indicator
 * [POS]: design-system AI 消息家族正文根；Thinking/Tool/Streaming 互斥语义由上层消息适配器决定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

import { StreamingText } from "./StreamingText";

type AssistantMessageProps = {
  author?: string;
  children?: ReactNode;
  content: string;
  onProgress?: () => void;
  renderContent?: (text: string) => ReactNode;
  streaming?: boolean;
};

export function AssistantMessage({
  author = "备忘录助手",
  children,
  content,
  onProgress,
  renderContent,
  streaming = false,
}: AssistantMessageProps) {
  return (
    <section
      aria-label={`${author}的消息`}
      className="ds-assistant-message"
    >
      <p className="ds-assistant-message-author">{author}</p>
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
