/**
 * [INPUT]: 依赖 exploreClient 的 ExploreResult 类型与 shared/design-system 的图标/Button
 * [OUTPUT]: 对外提供 ExploreResultPanel，展示关联笔记标题/理由/摘录/置信度，点击跳转到对应笔记
 * [POS]: app/src/widgets 的探索结果静态清单；只在 reduced-motion 或窗口窄到距离读不出来时替代径向星野——那是它唯一的用途，正常路径由 ExploreStage 承担。纯展示组件，不持有状态，关闭与跳转均由父层决定行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { SparkleIcon, XIcon } from "../shared/design-system/icons";
import { Button } from "../shared/design-system/components";
import type { ExploreResult } from "./AgentPanel/exploreClient";

type ExploreResultPanelProps = {
  exploring: boolean;
  onClose: () => void;
  onSelectMemo: (nodeId: string) => void;
  result: ExploreResult | null;
};

export function ExploreResultPanel({
  exploring,
  onClose,
  onSelectMemo,
  result,
}: ExploreResultPanelProps) {
  return (
    <div className="explore-result-panel" role="region" aria-label="探索到的关联笔记">
      <div className="explore-result-panel-header">
        <span className="explore-result-panel-title">
          <SparkleIcon size={16} />
          关联笔记
        </span>
        <Button
          aria-label="关闭探索结果"
          icon={XIcon}
          onClick={onClose}
          size="square"
          variant="secondary"
        />
      </div>

      {exploring ? (
        <div className="explore-result-panel-loading" role="status">
          正在寻找关联笔记…
        </div>
      ) : result === null || result.related.length === 0 ? (
        <div className="explore-result-panel-empty">
          暂未找到明确相关的笔记。
        </div>
      ) : (
        <ul className="explore-result-panel-list">
          {result.related.map((item) => (
            <li className="explore-result-item" key={item.node_id}>
              <button
                className="explore-result-item-button"
                onClick={() => onSelectMemo(item.node_id)}
                type="button"
              >
                <div className="explore-result-item-header">
                  <span className="explore-result-item-title">{item.title}</span>
                  <span className="explore-result-item-confidence">
                    {Math.round(item.confidence * 100)}%
                  </span>
                </div>
                <p className="explore-result-item-reason">{item.reason}</p>
                <blockquote className="explore-result-item-excerpt">
                  {item.excerpt}
                </blockquote>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
