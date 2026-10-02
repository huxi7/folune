/**
 * [INPUT]: 依赖 useLocale 的画布壳文案；依赖 motion/react、可选 CanvasEntryBootstrap、共享 EdgeDock、ArchiveCord 空闲上下文、canvasChromeStore/canvasWorkspaceStore、KnowledgeCanvas 会话控制与 Quiet Editorial token；左右工具由 Dashboard 持久宿主承载
 * [OUTPUT]: 对外提供可预载、可消费一次性 detail、可向路由暴露 flush 且中央始终保持同一 React Flow 实例的全视口 CanvasWorkspace
 * [POS]: widgets 的 Canvas V2 会话壳；负责返回 flush、Panel 会话状态、每画布布局记忆与空间布局，数据/交互/恢复归 KnowledgeCanvas；文件库宿主在路由壳外持久挂载，Canvas 只提供其开关语义，左右面板各自独立
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useLocale } from "../shared/locale";
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
} from "react";

import {
  AssistantPanelOpenIcon,
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import { useCanvasChromeStore } from "../shared/store/canvasChromeStore";
import {
  CANVAS_DUAL_PANEL_BREAKPOINT,
  CANVAS_PANEL_BREAKPOINT,
  type CanvasChromeState,
} from "../shared/store/canvasChromePolicy";
import { useCanvasWorkspaceStore } from "../shared/store/canvasWorkspaceStore";
import type { CanvasReturnDescriptor } from "../shared/store/canvasReturnStore";
import type { CanvasEntryBootstrap } from "../pages/canvasEntryBootstrap";
import {
  fadeTransition,
  reducedFadeTransition,
} from "../pages/workspaceMotion";
import { CanvasStageLoading } from "./CanvasStageLoading";
import { EdgeDock } from "./EdgeDock";
import { CanvasTitle } from "./KnowledgeCanvas/CanvasTitle";
import type { CanvasSessionControls } from "./KnowledgeCanvas/useCanvasSessionCoordinator";

const loadKnowledgeCanvas = () => import("./KnowledgeCanvas");

export const preloadKnowledgeCanvas = () => {
  void loadKnowledgeCanvas();
};

const KnowledgeCanvas = lazy(() =>
  loadKnowledgeCanvas().then((module) => ({
    default: module.KnowledgeCanvas,
  })),
);

type CanvasWorkspaceProps = {
  accessToken: string;
  bootstrap?: CanvasEntryBootstrap | null;
  canvasId: string;
  onNavigateMemo: (nodeId: string, descriptor: CanvasReturnDescriptor) => void;
  onRename: (title: string) => Promise<void>;
  onSessionReady?: (controls: CanvasSessionControls | null) => void;
  restore?: CanvasReturnDescriptor | null;
  style: CSSProperties;
  title: string;
  userId: string;
};

export function CanvasWorkspace({
  accessToken,
  bootstrap = null,
  canvasId,
  onNavigateMemo,
  onRename,
  onSessionReady,
  restore = null,
  style,
  title,
  userId,
}: CanvasWorkspaceProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const sessionCanvasId = useCanvasWorkspaceStore((state) => state.canvasId);
  const sessionAssistantOpen = useCanvasWorkspaceStore((state) => state.assistantOpen);
  const sessionLibraryOpen = useCanvasWorkspaceStore((state) => state.libraryOpen);
  const setCanvasChrome = useCanvasWorkspaceStore((state) => state.setCanvasChrome);
  const rememberChrome = useCanvasChromeStore((state) => state.remember);
  /*
   * 进入语境只在挂载那一刻解释一次: 返回描述优先(从原文回到画布要恢复离开前的
   * 样子), 否则交给 canvasChromeStore 按 memo_default / standalone / tree /
   * direct 四种意图解析。解析结果被 Store 幂等缓存, 因此 StrictMode 双渲染与
   * 后续重渲染都得到同一个答案, 也绝不读写 Paper 的用户级偏好。
   */
  const [entryChrome] = useState<CanvasChromeState>(() => {
    if (restore?.canvasId === canvasId) {
      return {
        assistantOpen: restore.assistantOpen,
        libraryOpen: restore.libraryOpen,
      };
    }
    // 没有视口就没有断点可言(服务端渲染与结构测试), 一律按双关闭起步
    if (typeof window === "undefined") {
      return { assistantOpen: false, libraryOpen: false };
    }
    return useCanvasChromeStore.getState()
      .entryChrome(canvasId, window.innerWidth);
  });
  const assistantOpen = sessionCanvasId === canvasId
    ? sessionAssistantOpen
    : entryChrome.assistantOpen;
  const libraryOpen = sessionCanvasId === canvasId
    ? sessionLibraryOpen
    : entryChrome.libraryOpen;
  const [overlayPanels, setOverlayPanels] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < CANVAS_PANEL_BREAKPOINT);
  const controlsRef = useRef<CanvasSessionControls | null>(null);
  const anyPanelOpen = assistantOpen || libraryOpen;

  const registerControls = useCallback((controls: CanvasSessionControls | null) => {
    controlsRef.current = controls;
    onSessionReady?.(controls);
  }, [onSessionReady]);

  const closeAssistant = useCallback(() => {
    setCanvasChrome({ assistantOpen: false });
  }, [setCanvasChrome]);

  const closeLibrary = useCallback(() => {
    setCanvasChrome({ libraryOpen: false });
  }, [setCanvasChrome]);

  const openAssistant = useCallback(() => {
    setCanvasChrome({
      assistantOpen: true,
      ...(window.innerWidth < CANVAS_DUAL_PANEL_BREAKPOINT
        ? { libraryOpen: false }
        : {}),
    });
  }, [setCanvasChrome]);

  const openLibrary = useCallback(() => {
    setCanvasChrome({
      ...(window.innerWidth < CANVAS_DUAL_PANEL_BREAKPOINT
        ? { assistantOpen: false }
        : {}),
      libraryOpen: true,
    });
  }, [setCanvasChrome]);

  useEffect(() => {
    const handleResize = () => {
      const overlay = window.innerWidth < CANVAS_PANEL_BREAKPOINT || (
        libraryOpen
        && assistantOpen
        && window.innerWidth < CANVAS_DUAL_PANEL_BREAKPOINT
      );
      setOverlayPanels(overlay);
      if (
        window.innerWidth < CANVAS_PANEL_BREAKPOINT
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

  /*
   * 只有用户亲手开关过, 才写进这张画布的最近布局。挂载时那一次是进入策略的
   * 输出而不是用户的偏好 —— 把它也记下来, 会让"新建时自动展开""从笔记进入自动
   * 收起"变成永久的假偏好, 之后每次进来都照抄一遍系统自己的决定。
   */
  const entryPersistedRef = useRef(false);
  useEffect(() => {
    if (!entryPersistedRef.current) {
      entryPersistedRef.current = true;
      return;
    }
    rememberChrome(canvasId, { assistantOpen, libraryOpen });
  }, [assistantOpen, canvasId, libraryOpen, rememberChrome]);

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

  return (
      <main
        aria-label={t(`知识画布：${title}`, `Knowledge canvas: ${title}`)}
        className="app-workspace canvas-workspace"
        data-assistant-open={assistantOpen}
        data-entry-motion={bootstrap === null ? "crossfade" : "view-transition"}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        style={style}
      >
      <section className="canvas-stage">
        {/*
          顶层分区只有四块: 左上开关+标题、右上 AI 开关、底部中央命令、右下保存
          状态。全部锚在 canvas-stage 上并共用同一组 --canvas-chrome-* 变量，
          因此侧栏预留安全区时它们跟着让位，不靠零散的 top/left 互相躲避。
          开关槽位常驻: Panel 打开后按钮进入 Panel 自己的 Header，槽位留空以
          保证标题的横坐标不因开合而移动。
        */}
        <div className="canvas-chrome canvas-chrome-start">
          <span className="canvas-chrome-slot">
            <AnimatePresence initial={false}>
              {!libraryOpen ? (
                <motion.span
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  transition={reduceMotion ? reducedFadeTransition : fadeTransition}
                >
                  <EdgeDock
                    icon={<SidebarSimpleIcon size={16} />}
                    label={t("文件库", "Library")}
                    onClick={openLibrary}
                    side="left"
                  />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
          <CanvasTitle onRename={onRename} title={title} />
        </div>

        <div className="canvas-chrome canvas-chrome-end">
          <span className="canvas-chrome-slot">
            <AnimatePresence initial={false}>
              {!assistantOpen ? (
                <motion.span
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  transition={reduceMotion ? reducedFadeTransition : fadeTransition}
                >
                  <EdgeDock
                    icon={<AssistantPanelOpenIcon size={16} />}
                    label="AI"
                    onClick={openAssistant}
                    side="right"
                  />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </div>

        <Suspense
          fallback={<CanvasStageLoading visible />}
        >
          <KnowledgeCanvas
            accessToken={accessToken}
            bootstrap={bootstrap}
            canvasId={canvasId}
            entryChrome={entryChrome}
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
        {overlayPanels && anyPanelOpen ? (
          <motion.button
            animate={{ opacity: 1 }}
            aria-label={t("关闭浮动工具", "Close floating tools")}
            className="workspace-panel-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => {
              closeAssistant();
              closeLibrary();
            }}
            transition={reduceMotion ? reducedFadeTransition : fadeTransition}
            type="button"
          />
        ) : null}
      </AnimatePresence>
      </main>
  );
}
