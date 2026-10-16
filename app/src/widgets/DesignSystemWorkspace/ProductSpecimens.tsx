/**
 * [INPUT]: 依赖生产 CanvasCardView/Cord/Controls、React Flow、NotePaper、助手外壳及共享消息与表单原语
 * [OUTPUT]: ProductSpecimens 与 hasProductSamples，以 query 筛选本地 Canvas 与助手交互样板
 * [POS]: Design System 的产品组合层；用本地内容演示卡片、关系与助手交互，不连接账户数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
  type Connection, type NodeProps,
} from "@xyflow/react";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "@xyflow/react/dist/style.css";
import {
  CANVAS_MEMO_HEIGHT, CANVAS_MEMO_WIDTH, CANVAS_TEXT_HEIGHT, CANVAS_TEXT_WIDTH,
  type CanvasFlowEdge, type CanvasFlowNode,
} from "../../pages/canvasPresentation";
import {
  AssistantMessage, Button, Dialog, MentionInput, SegmentedControl, Select,
  ThinkingIndicator, UserMessageBubble,
} from "../../shared/design-system/components";
import { ArrowUpIcon, XIcon } from "../../shared/design-system/icons";
import { AgentPanelHeader } from "../AgentPanel/AgentPanelHeader";
import type { AgentPresence } from "../AgentPanel/activityState";
import { ASSISTANT_COMPACT_HEIGHT, ASSISTANT_DEFAULT_WIDTH } from "../assistantGeometry";
import { CanvasActionsProvider, type CanvasActions } from "../KnowledgeCanvas/canvasActions";
import { CanvasCardView } from "../KnowledgeCanvas/CanvasCardView";
import { CanvasControls } from "../KnowledgeCanvas/CanvasControls";
import { CanvasCordEdge } from "../KnowledgeCanvas/CanvasCordEdge";
import { CanvasElasticConnectionLine } from "../KnowledgeCanvas/CanvasElasticConnectionLine";
import { CanvasManipulationFeedback } from "../KnowledgeCanvas/CanvasManipulationFeedback";
import { CanvasSelectionBounds } from "../KnowledgeCanvas/CanvasSelectionBounds";
import { matchesReference } from "./search";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { NotePaper } from "../NotePaper";
import { WorkspaceAssistantLayer } from "../WorkspaceAssistantLayer";
import "../../styles/design-system-product.css";

type CardState = "ready" | "working" | "trash" | "deleted";
const cardStates = [
  { value: "ready", label: "可用" }, { value: "working", label: "AI 工作中" },
  { value: "trash", label: "在回收站" }, { value: "deleted", label: "原文已删除" },
] as const;
const presenceOptions = [
  { value: "idle", label: "空闲" }, { value: "working", label: "处理中" },
  { value: "approval", label: "待确认" }, { value: "complete", label: "已完成" },
  { value: "error", label: "需处理" },
] as const;
const assistantModes = [{ value: "window", label: "阅读窗口" }, { value: "capsule", label: "胶囊" }] as const;
const initialBody = "记录先于分类。\n\n把注意力留给正在发生的想法，让结构从内容之间的关系中自然出现。\n\n一张笔记可以同时进入不同画布，原文始终只有一份。";

function memoNode(id: string, title: string, x: number, y: number): CanvasFlowNode {
  return {
    id, type: "canvasNode", position: { x, y }, width: CANVAS_MEMO_WIDTH, height: CANVAS_MEMO_HEIGHT,
    data: { body: initialBody, createdBy: "user", discoveredFromId: null, kind: "memo_ref", targetDeleted: false,
      targetNodeId: id, textHeight: null, textScale: 1, textWidth: null, title, tombstone: false },
  };
}
function initialNodes(): CanvasFlowNode[] {
  return [
    { ...memoNode("ds-canvas-note", "把想法，写下来", 0, 20), selected: true },
    memoNode("ds-canvas-neighbor", "在内容之间建立关系", 400, 80),
    { id: "ds-canvas-text", type: "canvasNode", position: { x: 32, y: 440 },
      width: CANVAS_TEXT_WIDTH, height: CANVAS_TEXT_HEIGHT,
      data: { body: "结构可以晚一点出现。\n双击这段文字试试。", createdBy: "user", discoveredFromId: null,
        kind: "native", targetDeleted: false, targetNodeId: null, textHeight: CANVAS_TEXT_HEIGHT,
        textScale: 1, textWidth: CANVAS_TEXT_WIDTH, title: "自由文字", tombstone: false } },
  ];
}
const initialEdges: CanvasFlowEdge[] = [{
  id: "ds-canvas-relation", type: "cord", source: "ds-canvas-note", target: "ds-canvas-neighbor",
  data: { createdBy: "user", rationale: "先记录，再沿着内容之间的关系理解它。" },
}];
type CanvasFixtureState = { cardState: CardState; editingId: string | null; previewId: string | null; sourceId: string | null };
const CanvasFixtureContext = createContext<CanvasFixtureState>({ cardState: "ready", editingId: null, previewId: null, sourceId: null });
function SpecimenNode(props: NodeProps<CanvasFlowNode>) {
  const state = useContext(CanvasFixtureContext);
  const primary = props.id === "ds-canvas-note";
  const data = primary ? { ...props.data, targetDeleted: state.cardState === "trash", tombstone: state.cardState === "deleted" } : props.data;
  return <CanvasCardView {...props} data={data} editing={state.editingId === props.id}
    previewing={state.previewId === props.id} aiLoading={primary && state.cardState === "working"}
    connectionSourceId={state.sourceId} validConnectionTarget={state.sourceId !== null && state.sourceId !== props.id && data.kind === "memo_ref" && !data.targetDeleted && !data.tombstone} />;
}
const nodeTypes = { canvasNode: SpecimenNode };
const edgeTypes = { cord: CanvasCordEdge };

function CanvasScene() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(initialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>(initialEdges);
  const [cardState, setCardState] = useState<CardState>("ready");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [notice, setNotice] = useState("拖动卡片；双击阅读笔记或编辑文字。");
  const flow = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const preview = nodes.find(node => node.id === previewId);
  const connect = (connection: Connection) => {
    if (connection.source === connection.target) return;
    setEdges(current => current.some(edge => [edge.source, edge.target].sort().join() === [connection.source, connection.target].sort().join()) ? current : [...current, {
      id: `ds-relation-${connection.source}-${connection.target}`, type: "cord", source: connection.source, target: connection.target,
      data: { createdBy: "user", rationale: "沿着内容之间的关系，让想法继续生长。" },
    }]);
    setSourceId(null);
    setNotice("关系已建立。点击连线查看理由。");
  };
  const actions = useMemo<CanvasActions>(() => ({
    onCancelText: () => setEditingId(null),
    onCommitText: async (id, text, geometry) => {
      setNodes(current => current.map(node => node.id === id ? {
        ...node, width: geometry.width, height: geometry.height,
        data: { ...node.data, body: text, textHeight: geometry.height, textWidth: geometry.width, textScale: geometry.scale },
      } : node));
      setEditingId(null);
    },
    onConnect: id => setSourceId(current => current === id ? null : id),
    onEditText: setEditingId,
    onExpand: async id => {
      const expandedId = "ds-canvas-expanded";
      const expanded = memoNode(expandedId, "从记录走向理解", 800, 20);
      setNodes(current => current.some(node => node.id === expandedId) ? current : [...current, {
        ...expanded, data: { ...expanded.data, createdBy: "ai", discoveredFromId: id },
      }]);
      setEdges(current => current.some(edge => edge.target === expandedId) ? current : [...current, {
        id: "ds-canvas-expansion", type: "cord", source: id, target: expandedId,
        data: { createdBy: "ai", rationale: "从已有想法，寻找下一条可探索的线索。" },
      }]);
      setNotice("已加入拓展示例。");
      requestAnimationFrame(() => { void flow.fitView({ padding: 0.15, maxZoom: 1 }); });
    },
    onOpenMemo: setPreviewId,
    onPrefetchMemo: () => undefined,
    onPreview: setPreviewId,
    onRemove: async id => { setNodes(current => current.filter(node => node.id !== id)); setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id)); },
    onRemoveEdge: async id => setEdges(current => current.filter(edge => edge.id !== id)),
    onResize: async (id, geometry) => setNodes(current => current.map(node => node.id === id ? {
      ...node, width: geometry.width, height: geometry.height, position: { x: geometry.x ?? node.position.x, y: geometry.y ?? node.position.y },
      data: { ...node.data, textHeight: geometry.height, textWidth: geometry.width, textScale: geometry.scale },
    } : node)),
  }), [flow, setEdges, setNodes]);
  const reset = () => {
    setNodes(initialNodes()); setEdges(initialEdges); setCardState("ready"); setEditingId(null); setSourceId(null);
    setNotice("样本已重置。");
    requestAnimationFrame(() => { void flow.fitView({ padding: 0.15, maxZoom: 1 }); });
  };
  return <>
    <div className="ds-product-toolbar">
      <span>卡片状态</span><Select ariaLabel="首张卡片状态" options={cardStates} onValueChange={value => setCardState(value as CardState)} value={cardState} />
      <Button onClick={reset} variant="ghost">重置</Button>
    </div>
    <CanvasFixtureContext.Provider value={{ cardState, editingId, previewId, sourceId }}>
      <CanvasActionsProvider actions={actions}>
        <div className="ds-product-canvas-stage app-workspace canvas-workspace" aria-label="本地 Canvas 组件交互样板">
          <div className="knowledge-canvas">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              connectOnClick={false} nodesDraggable nodesConnectable elementsSelectable selectionOnDrag
              panActivationKeyCode="Space" panOnDrag={[1, 2]} multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect}
              onConnectStart={(_, parameters) => setSourceId(parameters.nodeId)} onConnectEnd={() => setSourceId(null)}
              connectionLineComponent={CanvasElasticConnectionLine}
              onNodeClick={(_, node) => { if (sourceId !== null && sourceId !== node.id && node.data.kind === "memo_ref" && !(node.id === "ds-canvas-note" && ["trash", "deleted"].includes(cardState))) connect({ source: sourceId, target: node.id, sourceHandle: null, targetHandle: null }); }}
              onPaneClick={() => setSourceId(null)}
              fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} minZoom={0.2} maxZoom={2}
              deleteKeyCode={null} zoomOnScroll={false} zoomOnDoubleClick={false} preventScrolling={false}
              proOptions={{ hideAttribution: true }}>
              <Background gap={26} size={1} variant={BackgroundVariant.Dots} />
              <CanvasSelectionBounds nodes={nodes} />
              {previewId === null && sourceId === null ? <CanvasManipulationFeedback /> : null}
              <CanvasControls onAdd={() => { setNodes(current => current.some(node => node.id === "ds-canvas-added") ? current : [...current, memoNode("ds-canvas-added", "新加入的笔记", 400, 500)]); setNotice("已加入笔记示例。"); }}
                onFit={() => { void flow.fitView({ padding: 0.15, maxZoom: 1 }); }}
                onZoomIn={() => { void flow.zoomIn(); }} onZoomOut={() => { void flow.zoomOut(); }} />
            </ReactFlow>
          </div>
        </div>
      </CanvasActionsProvider>
    </CanvasFixtureContext.Provider>
    <p className="ds-product-note" aria-live="polite">{sourceId !== null ? "点击另一张卡片连接，点击空白取消。" : notice}</p>
    <Dialog open={preview !== undefined} onOpenChange={open => { if (!open) setPreviewId(null); }} title={preview?.data.title ?? "笔记预览"} surface="bare" motion="none">
      {preview && <div className="canvas-preview-shell"><NotePaper autoFocus variant="reader" title={preview.data.title}>
        <MarkdownReadingView content={preview.data.body ?? ""} preserveSoftBreaks />
      </NotePaper><div className="canvas-preview-tools"><button aria-label="关闭样本预览" className="canvas-preview-tool" onClick={() => setPreviewId(null)} type="button"><XIcon size={16} /></button></div></div>}
    </Dialog>
  </>;
}

function AssistantScene() {
  const [open, setOpen] = useState(true);
  const [presence, setPresence] = useState<AgentPresence>("idle");
  const [draft, setDraft] = useState("");
  const [panelWidth, setPanelWidth] = useState<number>(ASSISTANT_DEFAULT_WIDTH);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = stage.current;
    if (!host) return;
    const measure = () => {
      const inset = parseFloat(getComputedStyle(host).paddingRight) || 0;
      setPanelWidth(Math.min(ASSISTANT_DEFAULT_WIDTH, Math.max(1, host.clientWidth - inset * 2)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host); measure();
    return () => observer.disconnect();
  }, []);
  return <>
    <div className="ds-product-toolbar">
      <SegmentedControl ariaLabel="助手展示形态" options={assistantModes} value={open ? "window" : "capsule"} onValueChange={value => setOpen(value === "window")} />
      <Select ariaLabel="助手胶囊活动状态" options={presenceOptions} value={presence} onValueChange={value => { setPresence(value as AgentPresence); setOpen(false); }} />
    </div>
    <div className="ds-product-assistant-stage app-workspace" ref={stage} style={{ "--ds-assistant-reading-height": `${ASSISTANT_COMPACT_HEIGHT}px` } as CSSProperties} aria-label="有界助手外壳样板">
      <div className="ds-product-stage-caption"><strong>对话随时继续。</strong><p>收起再展开，草稿仍在。</p></div>
      <WorkspaceAssistantLayer open={open} size="compact" panelWidth={panelWidth} widthMode="panel" presence={presence} onOpen={() => setOpen(true)} resizable={false}>
        <section className="agent-panel" aria-label="助手固定内容样本">
          <AgentPanelHeader historyOpen={false} title="把想法继续写下去" historyDisabled onToggleHistory={() => undefined} onCreate={() => setDraft("")} onClose={() => setOpen(false)} />
          <div className="agent-panel-body">
            <div className="agent-message-list">
              <UserMessageBubble>先把今天的想法记下来。</UserMessageBubble>
              {presence === "working" ? <ThinkingIndicator label="思考中" /> : <AssistantMessage content="从一句话开始就好。等你准备好，再一起找到它与其他想法的联系。" />}
            </div>
            <div className="agent-composer">
              <MentionInput aria-label="助手样本草稿" className="agent-chat-input" mentions={[]} onValueChange={setDraft} placeholder="写下草稿…" value={draft} />
              <div className="agent-composer-footer"><span /><Button aria-label="发送固定样本" className="agent-composer-action" disabled icon={ArrowUpIcon} size="square" variant="primary" /></div>
            </div>
          </div>
        </section>
      </WorkspaceAssistantLayer>
    </div>
  </>;
}

const productAliases = {
  canvas: "canvas 画布 卡片 纸张 自由文字 连线 关系 拓展 选中 搬动 工具栏 帮助 CanvasCardView CanvasControls CanvasCordEdge ElectricBorder",
  assistant: "assistant ai 助手 胶囊 浮窗 窗口 工作 状态 草稿 输入 WorkspaceAssistantLayer AgentPanelHeader",
};
function matchesProduct(aliases: string, query: string) {
  return matchesReference(`产品 组合 product signature ${aliases}`, query);
}
export function hasProductSamples(query: string) {
  return Object.values(productAliases).some(aliases => matchesProduct(aliases, query));
}

export function ProductSpecimens({ query = "" }: { query?: string }) {
  const matches = (aliases: string) => matchesProduct(aliases, query);
  return <div className="ds-product-specimens">
    {matches(productAliases.canvas) && <article className="ds-product-card" id="sample-CanvasComposition">
      <header><h3>Canvas · 画布</h3><p>笔记、自由文字与关系</p></header>
      <ReactFlowProvider><CanvasScene /></ReactFlowProvider>
    </article>}
    {matches(productAliases.assistant) && <article className="ds-product-card" id="sample-AssistantShell">
      <header><h3>Assistant · 助手</h3><p>窗口、胶囊与活动状态</p></header>
      <AssistantScene />
    </article>}
  </div>;
}
