/**
 * [INPUT]: 依赖 motion/react、EdgeDock/PaperSurface/ArchiveCord、左右工具插槽、稳定 paperIdentity 与整理结果定位信息
 * [OUTPUT]: 对外提供 Paper First 共享 Workspace Chrome、由面板状态闭包稳定驱动的响应式遮罩、Escape 收束与持久归档连线
 * [POS]: widgets 的写作工作台空间壳；Canvas 已成为独立持久 Workspace，旧临时探索舞台不再进入生产壳
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  AssistantPanelOpenIcon,
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import {
  fadeTransition,
  panelEnterTransition,
  panelExitTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import { ArchiveCordStage } from "./ArchiveCord";
import {
  resolveArchiveTargetNodeId,
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";
import { EdgeDock } from "./EdgeDock";
import { PaperSurface } from "./PaperSurface";

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
  const workspaceRef = useRef<HTMLDivElement>(null);
  const paperIdentityRef = useRef(paperIdentity);
  const shouldOverlayPanels = useCallback(() => window.innerWidth < PANEL_BREAKPOINT || (
    libraryOpen && assistantOpen && window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
  ), [assistantOpen, libraryOpen]);
  const [overlayPanels, setOverlayPanels] = useState(shouldOverlayPanels);
  const anyPanelOpen = libraryOpen || assistantOpen;

  useEffect(() => {
    const handleResize = () => {
      setOverlayPanels(shouldOverlayPanels());
      if (
        window.innerWidth < PANEL_BREAKPOINT
        && libraryOpen
        && assistantOpen
      ) {
        onCloseAssistant();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [assistantOpen, libraryOpen, onCloseAssistant, shouldOverlayPanels]);

  useEffect(() => {
    if (paperIdentityRef.current === paperIdentity) return;
    paperIdentityRef.current = paperIdentity;
    paperScrollRef.current?.scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [paperIdentity, reduceMotion]);

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
      if (assistantOpen) onCloseAssistant();
      else onCloseLibrary();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anyPanelOpen, assistantOpen, onCloseAssistant, onCloseLibrary]);

  const closeOverlay = () => {
    if (assistantOpen) onCloseAssistant();
    if (libraryOpen) onCloseLibrary();
  };

  const handleStagePointerDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!anyPanelOpen || !(event.target instanceof Element)) return;
    if (event.target.closest([
      ".paper-surface",
      ".workspace-floating-panel",
      ".workspace-stage-control",
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
    <ArchiveCordStage active={archiveCordVisible} refreshKey={archiveRefreshKey}>
      <div
        className="app-workspace"
        data-assistant-open={assistantOpen}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        onMouseDown={handleStagePointerDown}
        ref={workspaceRef}
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
              className="workspace-stage-control workspace-assistant-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
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
