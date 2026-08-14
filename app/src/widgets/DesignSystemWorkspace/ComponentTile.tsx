/**
 * [INPUT]: 依赖 React.memo、ComponentPreview 与 componentCatalog 的名称/职责元数据
 * [OUTPUT]: 对外提供标题、简述、真实预览与统一状态检查轨组成的 ComponentTile
 * [POS]: app/src/widgets/DesignSystemWorkspace 的同构陈列单元，被空间基础与组件卡片矩阵共同复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { memo } from "react";

import { ComponentPreview } from "./ComponentPreview";
import type { DesignSystemSample } from "./componentCatalog";

type ComponentTileProps = {
  sample: DesignSystemSample;
};

const interactionStates = [
  "Default",
  "Hover",
  "Focus",
  "Active",
  "Disabled",
  "Loading",
  "Error",
  "Dark",
  "Reduced motion",
] as const;

export const ComponentTile = memo(function ComponentTile({ sample }: ComponentTileProps) {
  return (
    <article
      className="ds-gallery-card"
      data-component={sample.id}
      id={`component-${sample.id.toLowerCase()}`}
    >
      <header className="ds-gallery-card-header">
        <h3>{sample.name}</h3>
        <p>{sample.summary}</p>
      </header>

      <div className="design-system-preview">
        <ComponentPreview sampleId={sample.id} />
      </div>

      {sample.category !== "Foundations" ? (
        <footer aria-label={`${sample.name} 状态检查轨`} className="ds-state-rail">
          {interactionStates.map((state) => <span key={state}>{state}</span>)}
        </footer>
      ) : null}
    </article>
  );
});
