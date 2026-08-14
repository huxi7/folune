/**
 * [INPUT]: 依赖 motion/react、EdgeDock/PaperSurface/ArchiveCord Signature 组件、左右工具插槽、稳定 paperIdentity 与整理结果定位信息
 * [OUTPUT]: 对外提供四层 Paper First 舞台、全尺寸 Escape/Canvas 空白关闭、响应式遮罩、共享 Panel 变形、持久归档连线和撤销回执
 * [POS]: app/src/widgets 的工作台空间壳；只协调可见空间和动作解释，编辑器、文件树、Run 与 AI 会话仍由各自稳定组件拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ChatCircleDotsIcon,
  FoldersIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  LayoutGroup,
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

import { Button } from "../shared/design-system/components";
import {
  fadeTransition,
  panelSpring,
  paperSpring,
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
  onDismissOrganize: () => void;
  onToggleAssistant: () => void;
  onToggleLibrary: () => void;
  onUndoOrganize: () => Promise<void>;
  organizeBusy: boolean;
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
  onDismissOrganize,
  onToggleAssistant,
  onToggleLibrary,
  onUndoOrganize,
  organizeBusy,
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
      ".organize-paper-receipt",
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
      <LayoutGroup id="paper-first-workspace">
        {!libraryOpen ? (
          <motion.div
            className="workspace-canvas-control workspace-library-control"
            layout
            transition={paperSpring}
          >
          <EdgeDock
            expanded={false}
            icon={<FoldersIcon size={16} weight="regular" />}
            label="文件库"
            mode="canvas"
            onClick={onToggleLibrary}
            side="left"
          />
          </motion.div>
        ) : null}
        {!assistantOpen ? (
          <motion.div
            className="workspace-canvas-control workspace-assistant-control"
            layout
            transition={paperSpring}
          >
          <EdgeDock
            expanded={false}
            icon={<ChatCircleDotsIcon size={16} weight="regular" />}
            label="AI"
            mode="canvas"
            onClick={onToggleAssistant}
            side="right"
          />
          </motion.div>
        ) : null}

        <AnimatePresence initial={false}>
          {libraryOpen ? (
            <motion.div
              animate={{ opacity: 1, scaleX: 1 }}
              className="app-sidebar-shell workspace-floating-panel"
              exit={{ opacity: 0, scaleX: reduceMotion ? 1 : 0.96 }}
              initial={{ opacity: 0, scaleX: reduceMotion ? 1 : 0.96 }}
              key="workspace-library"
              style={{ originX: 0 }}
              transition={reduceMotion ? fadeTransition : panelSpring}
            >
              <div className="workspace-panel-content workspace-panel-content-library">
                <EdgeDock
                  expanded
                  icon={<FoldersIcon size={16} weight="regular" />}
                  label="文件库"
                  mode="panel"
                  onClick={onCloseLibrary}
                  side="left"
                />
                {library}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="paper-stage-scroll" ref={paperScrollRef}>
          <motion.div
            className="paper-stage-layout"
            layout="position"
            transition={paperSpring}
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

            <AnimatePresence initial={false}>
              {presentation ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="organize-paper-receipt"
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                  key={`${presentation.runId}:${presentation.status}`}
                  transition={fadeTransition}
                >
                  <div className="organize-paper-receipt-copy">
                    <strong>{presentation.status === "succeeded" ? "已整理至" : "已恢复至"}</strong>
                    <span>{presentation.path}</span>
                  </div>
                  <div className="organize-paper-receipt-actions">
                    {presentation.status === "succeeded" ? (
                      <Button
                        disabled={organizeBusy}
                        onClick={() => void onUndoOrganize()}
                        variant="ghost"
                      >
                        撤销
                      </Button>
                    ) : null}
                    <Button
                      aria-label="关闭整理回执"
                      icon={XIcon}
                      onClick={onDismissOrganize}
                      size="square"
                      variant="ghost"
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {assistantOpen ? (
            <motion.div
              animate={{ opacity: 1, scaleX: 1 }}
              className="app-agent-shell workspace-floating-panel"
              exit={{ opacity: 0, scaleX: reduceMotion ? 1 : 0.96 }}
              initial={{ opacity: 0, scaleX: reduceMotion ? 1 : 0.96 }}
              key="workspace-assistant"
              style={{ originX: 1 }}
              transition={reduceMotion ? fadeTransition : panelSpring}
            >
              <div className="workspace-panel-content workspace-panel-content-assistant">
                <EdgeDock
                  expanded
                  icon={<ChatCircleDotsIcon size={16} weight="regular" />}
                  label="AI"
                  mode="panel"
                  onClick={onCloseAssistant}
                  side="right"
                />
                {assistant}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </LayoutGroup>

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
