/**
 * [INPUT]: 依赖 motion/react、EdgeDock/PaperSurface/ArchiveCord 组件、左右工具插槽、稳定 paperIdentity 与整理结果定位信息
 * [OUTPUT]: 对外提供四层 Paper First 舞台、全尺寸 Escape/Canvas 空白关闭、响应式遮罩、无弹跳 Panel 位移与持久归档连线；Panel 内部 Header 负责自身关闭入口
 * [POS]: app/src/widgets 的工作台空间壳；只协调可见空间和动作解释，Panel 开关不跨位置变形，编辑器、文件树、Run 与 AI 会话仍由各自稳定组件拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AssistantPanelOpenIcon,
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  fadeTransition,
  panelEnterTransition,
  panelExitTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import { ArchiveCordStage } from "./ArchiveCord";
import { EdgeDock } from "./EdgeDock";
import { PaperSurface } from "./PaperSurface";
import {
  resolveArchiveTargetNodeId,
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";

type PaperWorkspaceShellProps = {
  assistant: ReactNode;
  assistantOpen: boolean;
  library: ReactNode;
  libraryOpen: boolean;
  onCloseAssistant: () => void;
  onCloseLibrary: () => void;
  onToggleAssistant: () => void;
  onToggleLibrary: () => void;
  organizing: boolean;
  paper: ReactNode;
  paperIdentity: string;
  presentation: WorkspaceOrganizePresentation | null;
  style: CSSProperties;
};

const PANEL_BREAKPOINT = 1200;
const DUAL_PANEL_SAFE_BREAKPOINT = 1400;

export function PaperWorkspaceShell({
  assistant,
  assistantOpen,
  library,
  libraryOpen,
  onCloseAssistant,
  onCloseLibrary,
  onToggleAssistant,
  onToggleLibrary,
  organizing,
  paper,
  paperIdentity,
  presentation,
  style,
}: PaperWorkspaceShellProps) {
  const reduceMotion = useReducedMotion();
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const shouldOverlayPanels = () => window.innerWidth < PANEL_BREAKPOINT || (
    libraryOpen && assistantOpen && window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
  );
  const [overlayPanels, setOverlayPanels] = useState(shouldOverlayPanels);
  const anyPanelOpen = libraryOpen || assistantOpen;

  useEffect(() => {
    const handleResize = () => {
      setOverlayPanels(shouldOverlayPanels());
      if (
        window.innerWidth < PANEL_BREAKPOINT &&
        libraryOpen &&
        assistantOpen
      ) {
        onCloseAssistant();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [assistantOpen, libraryOpen, onCloseAssistant]);

  useEffect(() => {
    paperScrollRef.current?.scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [paperIdentity, reduceMotion]);

  useEffect(() => {
    if (!anyPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      // ---- Escape 层级仲裁 ----
      // 壳层是 Escape 的最后一级接收者, 内层 (弹窗/菜单/@候选/原地重命名/
      // 搜索框) 一旦已经消费掉这次 Escape, 壳层必须让行。
      // preventDefault 只阻止浏览器默认行为, 不阻止事件继续冒泡到 window,
      // 所以这里必须显式检查 defaultPrevented —— 否则一次 Escape 被两层
      // 同时消费, Panel 是条件渲染 (卸载), 误关等于草稿销毁。
      if (event.defaultPrevented) {
        return;
      }

      // 焦点在可编辑元素内时, Escape 属于该编辑上下文, 不是关闭 Panel 的信号。
      const active = document.activeElement;
      if (active instanceof HTMLElement && (
        active.isContentEditable ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      )) {
        return;
      }

      event.preventDefault();
      if (assistantOpen) {
        onCloseAssistant();
      } else {
        onCloseLibrary();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anyPanelOpen, assistantOpen, onCloseAssistant, onCloseLibrary]);

  const closeOverlay = () => {
    if (assistantOpen) {
      onCloseAssistant();
    }
    if (libraryOpen) {
      onCloseLibrary();
    }
  };

  const handleCanvasPointerDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!anyPanelOpen || !(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest([
      ".paper-surface",
      ".workspace-floating-panel",
      ".workspace-canvas-control",
      ".memo-context-menu",
      ".ds-dialog-panel",
      ".ds-toast",
    ].join(",")) !== null) {
      return;
    }

    closeOverlay();
  };

  const archiveTargetNodeId = resolveArchiveTargetNodeId(presentation);
  const archiveCordVisible = shouldShowArchiveCord({
    libraryOpen,
    overlayPanels,
    presentation,
  });
  const archiveRefreshKey = [
    presentation?.runId ?? "none",
    presentation?.status ?? "none",
    archiveTargetNodeId ?? "none",
    libraryOpen ? "library" : "closed",
  ].join(":");

  return (
    <ArchiveCordStage
      active={archiveCordVisible}
      refreshKey={archiveRefreshKey}
    >
      <div
        className="app-workspace"
        data-assistant-open={assistantOpen}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        onMouseDown={handleCanvasPointerDown}
        style={style}
      >
        <AnimatePresence initial={false}>
          {!libraryOpen ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="workspace-canvas-control workspace-library-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="workspace-library-trigger"
              transition={fadeTransition}
            >
              <EdgeDock
                icon={<SidebarSimpleIcon size={16} />}
                label="文件库"
                onClick={onToggleLibrary}
                side="left"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!assistantOpen ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="workspace-canvas-control workspace-assistant-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="workspace-assistant-trigger"
              transition={fadeTransition}
            >
              <EdgeDock
                icon={<AssistantPanelOpenIcon size={16} />}
                label="AI"
                onClick={onToggleAssistant}
                side="right"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {libraryOpen ? (
            <motion.div
              animate={{
                opacity: 1,
                transition: reduceMotion ? fadeTransition : panelEnterTransition,
                x: 0,
              }}
              className="app-sidebar-shell workspace-floating-panel"
              exit={{
                opacity: 0,
                transition: reduceMotion ? fadeTransition : panelExitTransition,
                x: reduceMotion ? 0 : -12,
              }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : -12 }}
              key="workspace-library"
            >
              <div className="workspace-panel-content workspace-panel-content-library">
                {library}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="paper-stage-scroll" ref={paperScrollRef}>
          <motion.div
            className="paper-stage-layout"
            layout="position"
            transition={workspaceLayoutTransition}
          >
            <PaperSurface
              archiveActive={archiveCordVisible}
              archiveDrawKey={`${presentation?.runId ?? "none"}-${presentation?.status ?? "none"}`}
              archiveSourceId="workspace"
              archiveTargetNodeId={archiveTargetNodeId}
              organizing={organizing}
              paperIdentity={paperIdentity}
              reducedMotion={Boolean(reduceMotion)}
            >
              {paper}
            </PaperSurface>
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {assistantOpen ? (
            <motion.div
              animate={{
                opacity: 1,
                transition: reduceMotion ? fadeTransition : panelEnterTransition,
                x: 0,
              }}
              className="app-agent-shell workspace-floating-panel"
              exit={{
                opacity: 0,
                transition: reduceMotion ? fadeTransition : panelExitTransition,
                x: reduceMotion ? 0 : 12,
              }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
              key="workspace-assistant"
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
              onClick={closeOverlay}
              transition={fadeTransition}
              type="button"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </ArchiveCordStage>
  );
}
