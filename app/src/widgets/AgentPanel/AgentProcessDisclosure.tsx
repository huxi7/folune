/**
 * [INPUT]: 依赖 React 本地展开状态、共享 Lucide Caret、SuperNote ThinkingMark 与真实生成 active 状态
 * [OUTPUT]: 对外提供顶部 Agent 状态入口、生成期强制展开、完成后可手动收起且不包裹最终正文的 AgentProcessDisclosure
 * [POS]: AgentPanel 回复过程容器，在过程内容之前管理透明度信息的显隐，不拥有工具/正文内容语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CaretRightIcon } from "../../shared/design-system/icons";
import {
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";

import { ThinkingMark } from "../../shared/design-system/components";

type AgentProcessDisclosureProps = {
  active: boolean;
  activeLabel?: string;
  children: ReactNode;
};

export function AgentProcessDisclosure({
  active,
  activeLabel = "正在思考",
  children,
}: AgentProcessDisclosureProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (active) {
      setExpanded(true);
    }
  }, [active]);

  return (
    <div className="agent-process-disclosure" data-expanded={expanded}>
      {active ? (
        <div
          aria-label={activeLabel}
          className="agent-process-status"
          role="status"
        >
          <ThinkingMark active aria-hidden="true" size={14} />
          <span>{activeLabel}</span>
        </div>
      ) : (
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="agent-process-toggle"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <ThinkingMark aria-hidden="true" size={14} />
          <span>思考过程</span>
          <CaretRightIcon aria-hidden="true" size={14} />
        </button>
      )}
      <div
        className="agent-process-content"
        hidden={!expanded}
        id={contentId}
      >
        {children}
      </div>
    </div>
  );
}
