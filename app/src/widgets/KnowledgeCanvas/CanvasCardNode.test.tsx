/**
 * [INPUT]: 依赖 Bun test、react-dom/server、ReactFlowProvider、稳定 canvasActions、canvasWorkspaceStore 与真实 CanvasCardNode
 * [OUTPUT]: 锁定 memo_ref 纵向卡片的中心正式 Handle、右下连接抓手/整卡 target、两项元信息动作、嵌套纸张结构、spatialSpring 与失效卡片边界
 * [POS]: KnowledgeCanvas 的卡片结构回归门禁；只断言真实组件产出的 DOM 契约，hover/焦点浮现由 CSS 承担并在浏览器验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, test } from "bun:test";
import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CanvasFlowNodeData } from "../../pages/canvasPresentation";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";
import { CanvasActionsProvider, type CanvasActions } from "./canvasActions";
import { CanvasCardNode, isCanvasNodeAiLoading } from "./CanvasCardNode";

const actions: CanvasActions = {
  onCancelText: () => undefined,
  onCommitText: async () => undefined,
  onConnect: () => undefined,
  onEditText: () => undefined,
  onExpand: async () => undefined,
      onOpenMemo: () => undefined,
      onPrefetchMemo: () => undefined,
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
  kind: "memo_ref",
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
  id = "card-1",
): string => renderToStaticMarkup(
  <ReactFlowProvider>
    <CanvasActionsProvider actions={actions}>
      <CanvasCardNode
        data={data}
        deletable
        draggable
        dragging={false}
        id={id}
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

afterEach(() => useCanvasWorkspaceStore.getState().reset());

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
    expect(html).toContain("canvas-card-whole-target");
    expect(html).toContain("canvas-card-connect-handle nodrag");
    // 抓手必须在底栏之内: 挂在卡片外的右下角会破坏这张纸完整的轮廓
    const meta = /class="canvas-card-meta nodrag"[\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
    expect(meta).toContain("canvas-card-connect-handle");
    expect(meta.indexOf("canvas-card-actions"))
      .toBeLessThan(meta.indexOf("canvas-card-connect-handle"));
    expect(html).toContain('aria-label="从这张卡片建立关系"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('aria-label="关联另一篇笔记"');
    expect(html.match(/class="canvas-card-action"/g)).toHaveLength(2);
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

  test("普通、墓碑与回收站都只有一个移除入口，恢复与确认语义留给会话层", () => {
    const available = renderCard(cardData());
    const tombstone = renderCard(cardData({
      body: null,
      targetNodeId: null,
      tombstone: true,
    }));
    const trashed = renderCard(cardData({ targetDeleted: true }));

    expect(available.match(/aria-label="从画布移除"/g)).toHaveLength(1);
    expect(available).toContain('aria-label="从这张卡片建立关系"');
    for (const html of [tombstone, trashed]) {
      expect(html).not.toContain("canvas-card-expand");
      expect(html).not.toContain('aria-label="AI 拓展这条分支"');
      expect(html).not.toContain('aria-label="关联另一篇笔记"');
      expect(html).not.toContain('aria-label="从这张卡片建立关系"');
      expect(html).not.toContain("canvas-card-whole-target");
      expect(html).toContain('aria-label="从画布移除"');
      expect(html.match(/aria-label="从画布移除"/g)).toHaveLength(1);
    }
    expect(tombstone).toContain('data-tombstone="true"');
    expect(tombstone).toContain("原文已不在库中");
    expect(trashed).toContain('class="canvas-card-status">在回收站');
  });

  test("元信息行只说「指向的东西不在了」，不再有消不掉的「原文已更新」", () => {
    /*
     * 卡片的标题与摘录读的是笔记最新内容, 所以"原文已更新"警告的那个不一致用户看不见;
     * 而 revision 快照只在创建时写一次, 这行字一旦出现就永久消不掉。既验证不了又处理不掉
     * 的警告只会被读成故障, 因此整条移除, 只留下真正需要用户知道且有出路的两种。
     */
    expect(renderCard(cardData())).toContain('class="canvas-card-status"></span>');
    expect(renderCard(cardData())).not.toContain("原文已更新");
    expect(renderCard(cardData({ targetDeleted: true })))
      .toContain('class="canvas-card-status">在回收站');
  });

  test("新节点先出现纸面，再延后正文且不动画 React Flow 外层", () => {
    const html = renderCard(cardData({
      motionState: {
        delayMs: 100,
        gestureId: "gesture-1",
        kind: "node-enter",
        offsetX: -12,
        offsetY: 4,
      },
    }));

    expect(html).toContain('data-motion-state="node-enter"');
    expect(html).toContain("--canvas-motion-content-delay:220ms");
    expect(html).toContain("opacity:0.68");
    expect(html).toContain("translateX(-12px) translateY(4px)");
  });

  test("AI 拓展选择器只命中源卡片，其他卡片保持稳定 false", () => {
    useCanvasWorkspaceStore.getState().setAiLoading(true, "card-1");
    const state = useCanvasWorkspaceStore.getState();

    expect(isCanvasNodeAiLoading(state, "card-1")).toBe(true);
    expect(isCanvasNodeAiLoading(state, "card-2")).toBe(false);
  });
});
