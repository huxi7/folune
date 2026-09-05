/**
 * [INPUT]: 依赖 React.memo、ComponentPreview 与 componentCatalog 的名称/职责元数据
 * [OUTPUT]: 对外提供标题、简述与真实预览组成的 ComponentTile
 * [POS]: app/src/widgets/DesignSystemWorkspace 的同构陈列单元；状态由预览中的真实交互表达，不另造说明轨
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { memo } from "react";

import { ComponentPreview } from "./ComponentPreview";
import type { DesignSystemSample } from "./componentCatalog";

type ComponentTileProps = {
  sample: DesignSystemSample;
};

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

    </article>
  );
});
