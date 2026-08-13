/**
 * [INPUT]: 依赖 motion/react、工作台统一动效配置、Design System Button、左右工具插槽、稳定 paperIdentity 与整理结果定位信息
 * [OUTPUT]: 对外提供四层 Paper First 舞台、响应式浮层/遮罩/Escape、纸张安全区布局、归档连线和持久撤销回执
 * [POS]: app/src/widgets 的工作台空间壳；只协调可见空间和动作解释，编辑器、文件树与 AI 会话仍由各自稳定组件拥有
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
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { Button } from "../shared/design-system/components";
import {
  fadeTransition,
  panelSpring,
  paperSpring,
} from "../pages/workspaceMotion";

export type WorkspaceOrganizePresentation = {
  memoId: string;
  path: string;
  runId: string;
  status: "succeeded" | "undone";
  targetFolderId: string | null;
};

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

type ConnectionPath = {
  d: string;
  height: number;
  width: number;
};

const PANEL_BREAKPOINT = 1200;
const DUAL_PANEL_SAFE_BREAKPOINT = 1400;
const CONNECTION_VISIBLE_MS = 1900;

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
  const workspaceRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const [connectionPath, setConnectionPath] = useState<ConnectionPath | null>(null);
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
    if (!overlayPanels || !anyPanelOpen) {
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
  }, [anyPanelOpen, assistantOpen, onCloseAssistant, onCloseLibrary, overlayPanels]);

  useLayoutEffect(() => {
    if (
      presentation === null ||
      !libraryOpen ||
      workspaceRef.current === null ||
      paperRef.current === null
    ) {
      setConnectionPath(null);
      return;
    }

    let frameId = 0;
    let settleTimer = 0;
    let hideTimer = 0;
    const targetNodeId = presentation.targetFolderId ?? presentation.memoId;

    const measure = () => {
      const workspace = workspaceRef.current;
      const paperElement = paperRef.current;
      const target = document.querySelector<HTMLElement>(
        `[data-memo-tree-row-id="${CSS.escape(targetNodeId)}"]`,
      );

      if (workspace === null || paperElement === null || target === null) {
        return;
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const paperRect = paperElement.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const startX = paperRect.left - workspaceRect.left + 2;
      const startY = paperRect.top - workspaceRect.top + 86;
      const endX = targetRect.right - workspaceRect.left + 6;
      const endY = targetRect.top - workspaceRect.top + targetRect.height / 2;
      const bend = Math.max(42, Math.abs(startX - endX) * 0.42);

      setConnectionPath({
        d: `M ${startX} ${startY} C ${startX - bend} ${startY}, ${endX + bend} ${endY}, ${endX} ${endY}`,
        height: workspaceRect.height,
        width: workspaceRect.width,
      });
    };

    frameId = window.requestAnimationFrame(() => {
      measure();
      settleTimer = window.setTimeout(measure, reduceMotion ? 0 : 360);
    });
    hideTimer = window.setTimeout(
      () => setConnectionPath(null),
      reduceMotion ? 700 : CONNECTION_VISIBLE_MS,
    );
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener("resize", measure);
    };
  }, [libraryOpen, presentation, reduceMotion]);

  const closeOverlay = () => {
    if (assistantOpen) {
      onCloseAssistant();
    }
    if (libraryOpen) {
      onCloseLibrary();
    }
  };

  return (
    <div
      className="app-workspace"
      data-assistant-open={assistantOpen}
      data-library-open={libraryOpen}
      data-overlay-panels={overlayPanels}
      ref={workspaceRef}
      style={style}
    >
      <LayoutGroup id="paper-first-workspace">
        <motion.div className="workspace-canvas-control workspace-library-control" layout transition={paperSpring}>
          <Button
            aria-expanded={libraryOpen}
            aria-label={libraryOpen ? "关闭文件库" : "打开文件库"}
            icon={FoldersIcon}
            onClick={onToggleLibrary}
            size="square"
            title={libraryOpen ? "关闭文件库" : "打开文件库"}
            variant={libraryOpen ? "secondary" : "ghost"}
          />
        </motion.div>
        <motion.div className="workspace-canvas-control workspace-assistant-control" layout transition={paperSpring}>
          <Button
            aria-expanded={assistantOpen}
            aria-label={assistantOpen ? "关闭 AI 思考空间" : "打开 AI 思考空间"}
            icon={ChatCircleDotsIcon}
            onClick={onToggleAssistant}
            size="square"
            title={assistantOpen ? "关闭 AI 思考空间" : "打开 AI 思考空间"}
            variant={assistantOpen ? "secondary" : "ghost"}
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {libraryOpen ? (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="app-sidebar-shell workspace-floating-panel"
              exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
              key="workspace-library"
              transition={reduceMotion ? fadeTransition : panelSpring}
            >
              {library}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="paper-stage-scroll" ref={paperScrollRef}>
          <motion.div
            className="paper-stage-layout"
            layout="position"
            transition={paperSpring}
          >
            <motion.section
              className="app-main-panel paper-surface"
              data-organizing={organizing}
              layout="position"
              ref={paperRef}
              transition={paperSpring}
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate={{ opacity: 1 }}
                  className="paper-content-transition"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0.35 }}
                  key={paperIdentity}
                  transition={fadeTransition}
                >
                  {paper}
                </motion.div>
              </AnimatePresence>
            </motion.section>

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
              animate={{ opacity: 1, x: 0 }}
              className="app-agent-shell workspace-floating-panel"
              exit={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
              key="workspace-assistant"
              transition={reduceMotion ? fadeTransition : panelSpring}
            >
              {assistant}
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

      <AnimatePresence initial={false}>
        {connectionPath ? (
          <motion.svg
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="organize-connection-layer"
            exit={{ opacity: 0 }}
            height={connectionPath.height}
            initial={{ opacity: 0 }}
            key={`${presentation?.runId ?? "none"}:${presentation?.status ?? "none"}`}
            viewBox={`0 0 ${connectionPath.width} ${connectionPath.height}`}
            width={connectionPath.width}
          >
            <motion.path
              animate={{ pathLength: 1 }}
              d={connectionPath.d}
              initial={{ pathLength: reduceMotion ? 1 : 0 }}
              transition={reduceMotion ? fadeTransition : { duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
