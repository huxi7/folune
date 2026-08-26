/**
 * [INPUT]: 依赖 motion/react、共享 EdgeDock/Panel 插槽、ArchiveCord 空闲上下文、canvasWorkspaceStore 临时 Chrome、KnowledgeCanvas 会话控制与 Quiet Editorial token
 * [OUTPUT]: 对外提供与 Paper 共用左右工具基础设施、但中央始终保持同一 React Flow 实例的全视口 CanvasWorkspace
 * [POS]: widgets 的 Canvas V2 会话壳；负责返回 flush、Panel 会话状态和空间布局，数据/交互/恢复归 KnowledgeCanvas
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  ArrowLeftIcon,
  AssistantPanelOpenIcon,
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import { useCanvasWorkspaceStore } from "../shared/store/canvasWorkspaceStore";
import type { CanvasReturnDescriptor } from "../shared/store/canvasReturnStore";
import {
  fadeTransition,
  panelEnterTransition,
  panelExitTransition,
} from "../pages/workspaceMotion";
import { ArchiveCordStage } from "./ArchiveCord";
import { EdgeDock } from "./EdgeDock";
import type { CanvasSessionControls } from "./KnowledgeCanvas/useCanvasSessionCoordinator";

const KnowledgeCanvas = lazy(() =>
  import("./KnowledgeCanvas").then((module) => ({
    default: module.KnowledgeCanvas,
  })),
);

type CanvasWorkspaceProps = {
  accessToken: string;
  assistant: ReactNode;
  canvasId: string;
  initialAssistantOpen: boolean;
  initialLibraryOpen: boolean;
  library: ReactNode;
  onExit: () => void;
  onNavigateMemo: (nodeId: string, descriptor: CanvasReturnDescriptor) => void;
  restore?: CanvasReturnDescriptor | null;
  style: CSSProperties;
  title: string;
  userId: string;
};

const PANEL_BREAKPOINT = 1200;
const DUAL_PANEL_SAFE_BREAKPOINT = 1400;

export function CanvasWorkspace({
  accessToken,
  assistant,
  canvasId,
  initialAssistantOpen,
  initialLibraryOpen,
  library,
  onExit,
  onNavigateMemo,
  restore = null,
  style,
  title,
  userId,
}: CanvasWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const sessionCanvasId = useCanvasWorkspaceStore((state) => state.canvasId);
  const sessionAssistantOpen = useCanvasWorkspaceStore((state) => state.assistantOpen);
  const sessionLibraryOpen = useCanvasWorkspaceStore((state) => state.libraryOpen);
  const setCanvasChrome = useCanvasWorkspaceStore((state) => state.setCanvasChrome);
  const assistantOpen = sessionCanvasId === canvasId
    ? sessionAssistantOpen
    : restore?.canvasId === canvasId
      ? restore.assistantOpen
      : initialAssistantOpen;
  const libraryOpen = sessionCanvasId === canvasId
    ? sessionLibraryOpen
    : restore?.canvasId === canvasId
      ? restore.libraryOpen
      : initialLibraryOpen;
  const [overlayPanels, setOverlayPanels] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < PANEL_BREAKPOINT);
  const [leaving, setLeaving] = useState(false);
  const controlsRef = useRef<CanvasSessionControls | null>(null);
  const anyPanelOpen = assistantOpen || libraryOpen;

  const registerControls = useCallback((controls: CanvasSessionControls | null) => {
    controlsRef.current = controls;
  }, []);

  const closeAssistant = useCallback(() => {
    setCanvasChrome({ assistantOpen: false });
  }, [setCanvasChrome]);

  const closeLibrary = useCallback(() => {
    setCanvasChrome({ libraryOpen: false });
  }, [setCanvasChrome]);

  const openAssistant = useCallback(() => {
    setCanvasChrome({
      assistantOpen: true,
      ...(window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
        ? { libraryOpen: false }
        : {}),
    });
  }, [setCanvasChrome]);

  const openLibrary = useCallback(() => {
    setCanvasChrome({
      ...(window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
        ? { assistantOpen: false }
        : {}),
      libraryOpen: true,
    });
  }, [setCanvasChrome]);

  useEffect(() => {
    const handleResize = () => {
      const overlay = window.innerWidth < PANEL_BREAKPOINT || (
        libraryOpen
        && assistantOpen
        && window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
      );
      setOverlayPanels(overlay);
      if (
        window.innerWidth < PANEL_BREAKPOINT
        && libraryOpen
        && assistantOpen
      ) {
        closeAssistant();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [assistantOpen, closeAssistant, libraryOpen]);

  useEffect(() => {
    if (!anyPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (
        active.isContentEditable
        || active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
      )) {
        return;
      }
      event.preventDefault();
      if (assistantOpen) closeAssistant();
      else closeLibrary();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anyPanelOpen, assistantOpen, closeAssistant, closeLibrary]);

  const exit = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      const result = await controlsRef.current?.flush();
      if (result?.persisted === false) return;
      onExit();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <ArchiveCordStage active={false} refreshKey={`canvas:${canvasId}`}>
      <main
        aria-label={`知识画布：${title}`}
        className="app-workspace canvas-workspace"
        data-assistant-open={assistantOpen}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        style={style}
      >
      <AnimatePresence initial={false}>
        {!libraryOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="workspace-stage-control workspace-library-control"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <EdgeDock
              icon={<SidebarSimpleIcon size={16} />}
              label="文件库"
              onClick={openLibrary}
              side="left"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!assistantOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="workspace-stage-control workspace-assistant-control"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <EdgeDock
              icon={<AssistantPanelOpenIcon size={16} />}
              label="AI"
              onClick={openAssistant}
              side="right"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {libraryOpen ? (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="app-sidebar-shell workspace-floating-panel"
            exit={{
              opacity: 0,
              transition: reduceMotion ? fadeTransition : panelExitTransition,
              x: reduceMotion ? 0 : -12,
            }}
            initial={{ opacity: 0, x: reduceMotion ? 0 : -12 }}
            transition={reduceMotion ? fadeTransition : panelEnterTransition}
          >
            <div className="workspace-panel-content workspace-panel-content-library">
              {library}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section className="canvas-stage">
        <div className="canvas-workspace-nav">
          <button
            aria-label="返回笔记"
            className="canvas-workspace-back"
            disabled={leaving}
            onClick={() => void exit()}
            type="button"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <div className="canvas-workspace-heading">
            <span>Canvas</span>
            <strong title={title}>{title}</strong>
          </div>
        </div>

        <Suspense
          fallback={(
            <div className="canvas-workspace-loading" role="status">
              正在打开 Canvas…
            </div>
          )}
        >
          <KnowledgeCanvas
            accessToken={accessToken}
            canvasId={canvasId}
            initialAssistantOpen={initialAssistantOpen}
            initialLibraryOpen={initialLibraryOpen}
            onCoordinatorReady={registerControls}
            onEditMemo={(nodeId) => {
              const descriptor = controlsRef.current?.getReturnDescriptor(title);
              if (descriptor !== undefined) onNavigateMemo(nodeId, descriptor);
            }}
            onSelectMemo={(nodeId) => {
              const descriptor = controlsRef.current?.getReturnDescriptor(title);
              if (descriptor !== undefined) onNavigateMemo(nodeId, descriptor);
            }}
            restore={restore}
            userId={userId}
          />
        </Suspense>
      </section>

      <AnimatePresence initial={false}>
        {assistantOpen ? (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="app-agent-shell workspace-floating-panel"
            exit={{
              opacity: 0,
              transition: reduceMotion ? fadeTransition : panelExitTransition,
              x: reduceMotion ? 0 : 12,
            }}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
            transition={reduceMotion ? fadeTransition : panelEnterTransition}
          >
            <div className="workspace-panel-content workspace-panel-content-assistant">
              {assistant}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {overlayPanels && anyPanelOpen ? (
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="关闭浮动工具"
            className="workspace-panel-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => {
              closeAssistant();
              closeLibrary();
            }}
            transition={fadeTransition}
            type="button"
          />
        ) : null}
      </AnimatePresence>
      </main>
    </ArchiveCordStage>
  );
}
