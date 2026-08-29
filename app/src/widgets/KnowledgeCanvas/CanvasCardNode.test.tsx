/**
 * [INPUT]: 依赖 Bun test、react-dom/server、@xyflow/react 的 ReactFlowProvider、canvasActions Context 与真实 CanvasCardNode
 * [OUTPUT]: 锁定 memo_ref 纵向卡片的中心重合关系锚点、嵌套纸张结构、渐隐摘录、常驻展开入口、固定高度元信息行，以及空/超长/墓碑/回收站/漂移五种数据下的结构稳定
 * [POS]: KnowledgeCanvas 的卡片结构回归门禁；只断言真实组件产出的 DOM 契约，hover/焦点浮现由 CSS 承担并在浏览器验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CanvasFlowNodeData } from "../../pages/canvasPresentation";
import { CanvasActionsProvider, type CanvasActions } from "./canvasActions";
import { CanvasCardNode } from "./CanvasCardNode";

const actions: CanvasActions = {
  aiLoading: false,
  editingTextNodeId: null,
  selectedNodeIds: [],
  onCancelText: () => undefined,
  onCommitText: async () => undefined,
  onConnect: () => undefined,
  onEditText: () => undefined,
  onExpand: async () => undefined,
  onOpenMemo: () => undefined,
  onPreview: () => undefined,
  onRemove: async () => undefined,
  onRemoveEdge: async () => undefined,
  onResize: async () => undefined,
};

const cardData = (
  overrides: Partial<CanvasFlowNodeData> = {},
): CanvasFlowNodeData => ({
  body: "少则得，多则惑。",
  createdBy: "user",
  discoveredFromId: null,
  drifted: false,
  kind: "memo_ref",
  snapshotRevision: 3,
  targetDeleted: false,
  targetNodeId: "memo-1",
  textHeight: null,
  textScale: 1,
  textWidth: null,
  title: "少则得",
  tombstone: false,
  ...overrides,
});

const renderCard = (
  data: CanvasFlowNodeData,
  selected = false,
): string => renderToStaticMarkup(
  <ReactFlowProvider>
    <CanvasActionsProvider actions={actions}>
      <CanvasCardNode
        data={data}
        deletable
        draggable
        dragging={false}
        id="card-1"
        isConnectable={false}
        selectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        selected={selected}
        type="canvasNode"
        zIndex={0}
      />
    </CanvasActionsProvider>
  </ReactFlowProvider>,
);

/**
 * 卡片骨架 = 纸张与卡片自身的类名序列。正文段落与空正文占位是同一个槽位的两种
 * 文案，因此归一化为一个名字：本函数比较的是几何骨架，不是文案。
 */
const skeleton = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1] ?? "")
    .filter((className) => className.startsWith("canvas-card")
      || className.startsWith("note-paper"))
    .map((className) => className === "note-paper-placeholder"
      ? "note-paper-excerpt"
      : className);

describe("Canvas memo card", () => {
  test("卡片是一张嵌套缩略纸张，元信息与操作在纸外自成一行", () => {
    const html = renderCard(cardData());

    expect(html).toContain('class="canvas-card"');
    expect(html).toContain('class="note-paper canvas-card-paper" data-variant="thumbnail"');
    expect(html).toContain('<h2 class="note-paper-title">少则得</h2>');
    expect(html).toContain('class="note-paper-excerpt">少则得，多则惑。');
    expect(html).toContain('class="canvas-card-meta nodrag"');
    expect(html.match(/canvas-card-center-handle/g)).toHaveLength(2);
    // 纸张只读快照，不在 Canvas 里渲染完整 Markdown 正文
    expect(html).not.toContain("markdown-reading-view");
  });

  test("展开入口常驻 DOM，可键盘聚焦且不改变卡片布局", () => {
    const resting = renderCard(cardData());
    const selectedCard = renderCard(cardData(), true);

    expect(resting).toContain('class="canvas-card-expand nodrag"');
    expect(resting).toContain('aria-label="展开阅读少则得"');
    // 选中态只改变 data 属性，DOM 骨架必须逐字相同：浮现纯粹由 CSS 透明度承担
    expect(skeleton(selectedCard)).toEqual(skeleton(resting));
    expect(selectedCard).toContain('data-selected="true"');
  });

  test("空正文、超长正文与超长标题都保持同一套骨架", () => {
    const short = renderCard(cardData());
    const empty = renderCard(cardData({ body: "" }));
    const blank = renderCard(cardData({ body: null }));
    const long = renderCard(cardData({
      body: "熵增者，妄作之果也。".repeat(400),
      title: "为学日益，为道日损，损之又损，以至于无为，无为而无不为".repeat(4),
    }));

    expect(skeleton(empty)).toEqual(skeleton(short));
    expect(skeleton(blank)).toEqual(skeleton(short));
    expect(skeleton(long)).toEqual(skeleton(short));
    expect(empty).toContain('class="note-paper-placeholder">这页还没有正文');
    expect(blank).toContain("note-paper-placeholder");
    expect(long).toContain("熵增者，妄作之果也。");
  });

  test("墓碑与回收站目标不提供阅读、AI 与关联入口，只保留移除", () => {
    const tombstone = renderCard(cardData({
      body: null,
      targetNodeId: null,
      tombstone: true,
    }));
    const trashed = renderCard(cardData({ targetDeleted: true }));

    for (const html of [tombstone, trashed]) {
      expect(html).not.toContain("canvas-card-expand");
      expect(html).not.toContain('aria-label="AI 拓展这条分支"');
      expect(html).not.toContain('aria-label="关联另一篇笔记"');
      expect(html).toContain('aria-label="从画布移除"');
    }
    expect(tombstone).toContain('data-tombstone="true"');
    expect(tombstone).toContain("原文已不在库中");
    expect(trashed).toContain('class="canvas-card-status">在回收站');
  });

  test("快照漂移在元信息行安静说明，不打断纸面阅读", () => {
    const html = renderCard(cardData({ drifted: true }));

    expect(html).toContain('class="canvas-card-status">原文已更新');
    expect(html).toContain("canvas-card-expand");
  });
});
