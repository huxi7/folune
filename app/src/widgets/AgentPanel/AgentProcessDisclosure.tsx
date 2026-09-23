/**
 * [INPUT]: 依赖 Collapse 的保留式高度披露、React 本地手动展开状态、共享 Lucide Caret、Folune ThinkingMark 与思考/工具阶段 active 状态
 * [OUTPUT]: 对外提供思考/工具阶段强制展开、进入正文或结束时自动收起且可手动回看的 AgentProcessDisclosure
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

import { ThinkingMark, Collapse } from "../../shared/design-system/components";

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
  const [expandedByUser, setExpandedByUser] = useState(false);
  const expanded = active || expandedByUser;

  useEffect(() => {
    if (active) {
      // 新一轮过程接管展开，结束时回到折叠；正文分块更新不覆盖用户回看。
      setExpandedByUser(false);
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
          onClick={() => setExpandedByUser((value) => !value)}
          type="button"
        >
          <ThinkingMark aria-hidden="true" size={14} />
          <span>思考过程</span>
          <CaretRightIcon aria-hidden="true" size={14} />
        </button>
      )}
      <Collapse open={expanded} keepMounted>
      <div
        className="agent-process-content"
        id={contentId}
      >
        {children}
      </div>
      </Collapse>
    </div>
  );
}
