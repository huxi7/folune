/**
 * [INPUT]: 依赖 React Flow、生产 CanvasCardView/Cord/NotePaper/Dialog、本地节点正文与可空的笔记来路
 * [OUTPUT]: 对外提供固定关系的静态示例画布，只有笔记工具条入口提供返回该笔记
 * [POS]: 仅替换 Canvas 的会话/数据适配；卡片、关系线、预览纸与 Transition 沿生产实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useMemo, useState, useCallback, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { ReactFlow, ReactFlowProvider, useReactFlow, type NodeProps } from "@xyflow/react";
import type { MemoDetailNode } from "../../shared/api/memo";
import { CANVAS_MEMO_WIDTH, CANVAS_MEMO_HEIGHT, type CanvasFlowNode, type CanvasFlowEdge } from "../../pages/canvasPresentation";
import { runViewTransition } from "../../pages/viewTransition";
import { CanvasCardView } from "../KnowledgeCanvas/CanvasCardView";
import { CanvasCordEdge } from "../KnowledgeCanvas/CanvasCordEdge";
import { CanvasActionsProvider, type CanvasActions } from "../KnowledgeCanvas/canvasActions";
import { NotePaper } from "../NotePaper";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { Button, Dialog } from "../../shared/design-system/components";
import { ArrowLeftIcon, PencilSimpleIcon, XIcon, SidebarSimpleIcon, AssistantPanelOpenIcon } from "../../shared/design-system/icons";
import { EdgeDock } from "../EdgeDock";
import { demoExcerpt, INITIAL_MEMO } from "./model";

function DemoNode(props: NodeProps<CanvasFlowNode>) {
  return <CanvasCardView {...props} editing={false} previewing={false} aiLoading={false} connectionSourceId={null} validConnectionTarget={false} />;
}
const nodeTypes = { canvasNode: DemoNode };
const edgeTypes = { cord: CanvasCordEdge };
const nothing = () => {};
const completed = async () => {};
const ids = ["demo-walk", "demo-attention", "demo-writing"];
/*
 * 构图是这张 Demo 唯一的"取景"决定。要命的一点：**屏幕上卡片多大，与卡片在画布
 * 坐标里定多大无关**——取景会把它归一化掉。真正决定它的是
 *   （两侧面板之间真正看得见的宽度 ÷ 横排卡片数）× 1/(1 + 间距/卡片宽)，
 * 竖向同理，两者取小。所以能动的只有三个：可见带宽、几列、以及间距比。
 * 当前 2 列、间距比 68/280 ≈ 0.24，带宽约 490px，卡片因此落在约 206px；
 * 这已经是"三张都在框内、又都不被面板压住"能拿到的上限附近——
 * 再大只能靠放开画布缩放，而那正是真实 APP 里读得清的原因。
 */
const positions = [{ x: 0, y: 236 }, { x: 348, y: 0 }, { x: 392, y: 428 }];
const VIEW_PADDING = 0.07;
const VIEW_GAP = 14;
const sceneBounds = (count: number) => {
  const used = positions.slice(0, count);
  const minX = Math.min(...used.map(p => p.x)), minY = Math.min(...used.map(p => p.y));
  return {
    height: Math.max(...used.map(p => p.y)) + CANVAS_MEMO_HEIGHT - minY,
    minX, minY,
    width: Math.max(...used.map(p => p.x)) + CANVAS_MEMO_WIDTH - minX,
  };
};
function CanvasScene({ notes, active, origin, onEdit, onHint, libraryOpen, assistantOpen, onLibrary, onAssistant }: {
  notes: Record<string, MemoDetailNode>; active: boolean; origin: string | null;
  onEdit: (id: string) => void; onHint: () => void;
  libraryOpen: boolean; assistantOpen: boolean; onLibrary: () => void; onAssistant: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const title = "从散步到写作";
  const flow = useReactFlow();
  const root = useRef<HTMLDivElement>(null);
  const transition = useCallback((update: () => void, kind: "expand" | "collapse") => {
    if (!runViewTransition(() => flushSync(update), kind)) update();
  }, []);
  const openPreview = useCallback((id: string) => transition(() => setPreview(id), "expand"), [transition]);
  const closePreview = useCallback(() => transition(() => setPreview(null), "collapse"), [transition]);
  const actions = useMemo<CanvasActions>(() => ({
    onCancelText: nothing, onCommitText: completed, onConnect: onHint, onEditText: onHint,
    onExpand: async () => onHint(), onOpenMemo: onEdit, onPrefetchMemo: nothing,
    onPreview: openPreview, onRemove: async () => onHint(), onRemoveEdge: async () => onHint(), onResize: completed,
  }), [onEdit, onHint, openPreview]);
  const sceneIds = useMemo(() => {
    const source = origin ?? INITIAL_MEMO;
    return [source, ...ids.filter(id => id !== source).slice(0, 2)];
  }, [origin]);
  /*
   * 可见带的两端直接量面板自己：宽度规则住在 CSS（百分比 + 上下限），在这里再写一遍
   * 就成了第二份真相，而面板始终挂载，随时量得到。
   * 只依赖 stage 的尺寸而不是面板开合——面板开合不改变 stage，因此不会重取景，
   * 卡片也不会在用户收面板时自己变大。
   */
  const fit = useCallback(() => {
    const stage = root.current;
    if (!stage || stage.clientWidth === 0) return;
    const rect = stage.getBoundingClientRect();
    const bounds = sceneBounds(sceneIds.length);
    const edge = (selector: string) => {
      const element = stage.closest(".demo-workspace-frame")?.querySelector(selector);
      return element ? element.getBoundingClientRect() : null;
    };
    const sidebar = libraryOpen ? edge(".app-sidebar-shell") : null;
    const agent = assistantOpen ? edge(".app-agent-shell") : null;
    const left = (sidebar ? sidebar.right + VIEW_GAP : rect.left) - rect.left;
    const right = (agent ? agent.left - VIEW_GAP : rect.right) - rect.left;
    const bandWidth = Math.max(right - left, 1);
    const bandHeight = rect.height * (1 - 2 * VIEW_PADDING);
    const zoom = Math.min(bandWidth / bounds.width, bandHeight / bounds.height);
    void flow.setViewport({
      x: left + (bandWidth - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: rect.height * VIEW_PADDING + (bandHeight - bounds.height * zoom) / 2 - bounds.minY * zoom,
      zoom,
    });
  }, [assistantOpen, flow, libraryOpen, sceneIds.length]);
  useLayoutEffect(() => { fit(); }, [fit]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);
  const projected = useMemo<CanvasFlowNode[]>(() => sceneIds.map((id, i) => ({
    id, type: "canvasNode", position: positions[i]!, width: CANVAS_MEMO_WIDTH, height: CANVAS_MEMO_HEIGHT,
    data: { title: notes[id]!.title, body: demoExcerpt(notes[id]!.memo.content_mdx), kind: "memo_ref", targetNodeId: id,
      createdBy: "user", discoveredFromId: null, targetDeleted: false, tombstone: false,
      textHeight: null, textWidth: null, textScale: 1, paperTransitionActive: active && id !== preview },
  })), [sceneIds, notes, active, preview]);
  const edges = useMemo<CanvasFlowEdge[]>(() => [
    { id: "demo-e1", type: "cord", source: sceneIds[0]!, target: sceneIds[1]!, data: { createdBy: "ai", rationale: "从日常的小事中，重新找回注意力。" } },
    { id: "demo-e2", type: "cord", source: sceneIds[1]!, target: sceneIds[2]!, data: { createdBy: "ai", rationale: "把观察到的感受变成写作的起点。" } },
  ], [sceneIds]);
  return <main className="app-workspace canvas-workspace" data-library-open={libraryOpen} data-assistant-open={assistantOpen} data-overlay-panels="false" aria-label="知识画布">
    <section className="canvas-stage" ref={root}>
      <CanvasActionsProvider actions={actions}><div className="knowledge-canvas">
        <ReactFlow nodes={projected} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} panOnDrag={false} zoomOnPinch={false} deleteKeyCode={null} minZoom={0.3} maxZoom={1.5}
          className="demo-canvas-flow" zoomOnScroll={false} zoomOnDoubleClick={false} preventScrolling={false} proOptions={{ hideAttribution: true }} />
      </div></CanvasActionsProvider>
      <div className="canvas-chrome canvas-chrome-start"><span className="canvas-chrome-slot">
        {origin !== null && <Button aria-label="回到笔记" title="回到笔记" icon={ArrowLeftIcon} variant="ghost" size="square" onClick={() => onEdit(origin)} />}
        {!libraryOpen && <EdgeDock icon={<SidebarSimpleIcon size={16} />} label="文件库" onClick={onLibrary} side="left" />}
      </span><span className="canvas-title">{title}</span></div>
      <div className="canvas-chrome canvas-chrome-end"><span className="canvas-chrome-slot">
        {!assistantOpen && <EdgeDock icon={<AssistantPanelOpenIcon size={16} />} label="AI" onClick={onAssistant} side="right" />}
      </span></div>
      {preview && <Dialog open motion="none" surface="bare" title={notes[preview]!.title} onOpenChange={open => { if (!open) closePreview(); }}>
        <div className="canvas-preview-shell"><NotePaper autoFocus title={notes[preview]!.title} transitionIdentity={preview} variant="reader">
          <MarkdownReadingView content={notes[preview]!.memo.content_mdx} preserveSoftBreaks />
        </NotePaper><div className="canvas-preview-tools">
          <button aria-label="关闭预览" className="canvas-preview-tool" onClick={closePreview}><XIcon size={16} /></button>
          <button aria-label="编辑原文" className="canvas-preview-tool" onClick={() => { setPreview(null); onEdit(preview); }}><PencilSimpleIcon size={16} /></button>
        </div></div>
      </Dialog>}
    </section>
  </main>;
}
export function DemoCanvas(props: Parameters<typeof CanvasScene>[0]) {
  return <ReactFlowProvider><CanvasScene {...props} /></ReactFlowProvider>;
}
