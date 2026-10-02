/**
 * [INPUT]: 依赖跨空间助手开关/尺寸/自定义浮窗、用户共享宽度、八方向调整器、真实活动状态、DS 材质/动态偏好与 MotionValue
 * [OUTPUT]: 对外提供常驻三态与自由尺寸宿主；胶囊固定右下，四边四角拖拽逐帧只更新局部几何，松手提交；可供Demo按uiScale投影全部胶囊尺寸并关闭几何/透明度过渡与调整能力
 * [POS]: widgets 的助手专属外壳；Dashboard持有会话，纯策略裁决边界，MotionValue持有动画/手势同一几何，避免正文缩放、会话重挂或逐帧重渲染工作区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ShaderGlow } from "../shared/design-system/components/ShaderGlow";
import { ArrowUpIcon, CheckIcon, WarningCircleIcon } from "../shared/design-system/icons";
import { motionDuration, motionEase } from "../shared/design-system/motion";
import { useMotionPreference } from "../shared/design-system/useMotionPreference";
import { useLocale } from "../shared/locale";
import type { AssistantFrame, AssistantSize } from "../shared/store/workspaceChromeStore";
import type { AgentPresence } from "./AgentPanel/activityState";
import { ASSISTANT_CAPSULE, resolveAssistantGeometry, type AssistantRect } from "./assistantGeometry";
import { AssistantWindowResize } from "./AssistantWindowResize";

type WorkspaceAssistantLayerProps = {
  children: ReactNode;
  open: boolean;
  size: AssistantSize;
  panelWidth: number;
  presence?: AgentPresence;
  onOpen: () => void;
  frame?: AssistantFrame | null;
  onResize?: (rect: AssistantRect) => void;
  resizable?: boolean;
  uiScale?: number;
  animateGeometry?: boolean;
};

const readViewport = () => ({
  viewportWidth: typeof window === "undefined" ? 1440 : window.innerWidth,
  viewportHeight: typeof window === "undefined" ? 900 : window.innerHeight,
  availableHeight: typeof window === "undefined" ? 900 : window.visualViewport?.height ?? window.innerHeight,
  offsetTop: typeof window === "undefined" ? 0 : window.visualViewport?.offsetTop ?? 0,
  inset: typeof window === "undefined" ? 16 : (parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16) * (window.innerWidth < 1200 ? 0.75 : 1),
});

export function WorkspaceAssistantLayer({ children, open, size, panelWidth, presence = "idle", onOpen, frame = null, onResize, resizable = true, uiScale = 1, animateGeometry = true }: WorkspaceAssistantLayerProps) {
  const { t } = useLocale();
  const reduced = useMotionPreference();
  const [viewport, setViewport] = useState(readViewport);
  const bodyRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);
  const shellRef = useRef<HTMLDivElement>(null);
  const geometry = resolveAssistantGeometry({ ...viewport, panelWidth, size, frame, uiScale });
  const fullGeometry = resolveAssistantGeometry({ ...viewport, panelWidth, size: "expanded", uiScale });
  const capsuleWidth = ASSISTANT_CAPSULE.width * uiScale;
  const capsuleHeight = ASSISTANT_CAPSULE.height * uiScale;
  const capsuleRadius = ASSISTANT_CAPSULE.radius * uiScale;
  const width = useMotionValue(open ? geometry.width : capsuleWidth);
  const height = useMotionValue(open ? geometry.height : capsuleHeight);
  const right = useMotionValue(open ? geometry.right : fullGeometry.right);
  const bottom = useMotionValue(open ? geometry.bottom : fullGeometry.bottom);
  const radius = useMotionValue(open ? geometry.radius : capsuleRadius);
  const bodyWidth = useMotionValue(geometry.width);
  const bodyHeight = useMotionValue(geometry.height);
  const label = presence === "working" ? t("处理中", "Working")
    : presence === "approval" ? t("待确认", "Review")
    : presence === "complete" ? t("已完成", "Done")
    : presence === "error" ? t("需处理", "Attention") : "Folune AI";

  useEffect(() => {
    const sync = () => setViewport(readViewport());
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    if (wasOpenRef.current && !open && bodyRef.current?.contains(document.activeElement)) buttonRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    const transition = { type: "tween" as const, duration: reduced ? 0 : motionDuration.spatial, ease: motionEase.enter };
    bodyWidth.set(geometry.width);
    if (!animateGeometry) {
      width.set(open ? geometry.width : capsuleWidth);
      height.set(open ? geometry.height : capsuleHeight);
      right.set(open ? geometry.right : fullGeometry.right);
      bottom.set(open ? geometry.bottom : fullGeometry.bottom);
      radius.set(open ? geometry.radius : capsuleRadius);
      bodyHeight.set(geometry.height);
      return;
    }
    const jobs = [
      animate(width, open ? geometry.width : capsuleWidth, transition),
      animate(height, open ? geometry.height : capsuleHeight, transition),
      animate(right, open ? geometry.right : fullGeometry.right, transition),
      animate(bottom, open ? geometry.bottom : fullGeometry.bottom, transition),
      animate(radius, open ? geometry.radius : capsuleRadius, transition),
      animate(bodyHeight, geometry.height, transition),
    ];
    let active = true;
    void Promise.all(jobs).then(() => {
      if (active && open && document.activeElement === buttonRef.current) bodyRef.current?.querySelector<HTMLElement>('[contenteditable="true"], textarea')?.focus({ preventScroll: true });
    });
    return () => { active = false; jobs.forEach(job => job.stop()); };
  }, [geometry.width, geometry.height, geometry.right, geometry.bottom, geometry.radius, fullGeometry.right, fullGeometry.bottom, capsuleWidth, capsuleHeight, capsuleRadius, animateGeometry, open, reduced, width, height, right, bottom, radius, bodyWidth, bodyHeight]);

  const stopResizeMotion = () => [width, height, right, bottom, radius, bodyHeight].forEach(value => value.stop());
  const updateRect = (rect: AssistantRect) => {
    width.set(rect.width); height.set(rect.height);
    right.set(viewport.viewportWidth - rect.left - rect.width);
    bottom.set(viewport.viewportHeight - rect.top - rect.height);
    bodyWidth.set(rect.width); bodyHeight.set(rect.height);
  };

  const fade = { duration: reduced ? motionDuration.press : motionDuration.microExit };
  const scaleStyle = { "--assistant-ui-scale": uiScale } as CSSProperties;
  return <motion.div
    className="workspace-assistant-layer"
    ref={shellRef}
    data-assistant-mode={open ? size : "capsule"}
    data-animated={animateGeometry}
    data-presence={presence}
    initial={false}
    style={{ ...scaleStyle, width: animateGeometry ? width : open ? geometry.width : capsuleWidth, height: animateGeometry ? height : open ? geometry.height : capsuleHeight, right: animateGeometry ? right : open ? geometry.right : fullGeometry.right, bottom: animateGeometry ? bottom : open ? geometry.bottom : fullGeometry.bottom, borderRadius: animateGeometry ? radius : open ? geometry.radius : capsuleRadius }}
  >
    <div className="workspace-assistant-clip">
      <motion.div aria-hidden="true" className="workspace-assistant-material" initial={false} animate={animateGeometry ? { opacity: open ? 0 : 1 } : undefined} style={animateGeometry ? undefined : { opacity: open ? 0 : 1 }} transition={fade}>
        <span className="glow-button-base" />
        <span className="glow-button-flow">{!open ? <ShaderGlow className="glow-button-canvas" speed={0.25} intensity={10} /> : null}</span>
        <span className="glow-button-sheen" />
      </motion.div>
      <motion.div
        className="workspace-assistant-body"
        id="workspace-assistant-conversation"
        ref={bodyRef}
        aria-hidden={!open}
        inert={!open}
        initial={false}
        animate={animateGeometry ? { opacity: open ? 1 : 0 } : undefined}
        transition={{ ...fade, delay: open && !reduced ? 0.08 : 0 }}
        style={{ width: animateGeometry ? bodyWidth : geometry.width, height: animateGeometry ? bodyHeight : geometry.height, opacity: animateGeometry ? undefined : open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      >{children}</motion.div>
      <motion.button
        className="workspace-assistant-launcher"
        ref={buttonRef}
        aria-label={`${t("打开 AI 助手", "Open AI assistant")}${presence === "idle" ? "" : ` · ${label}`}`}
        aria-controls="workspace-assistant-conversation"
        aria-expanded={open}
        aria-hidden={open}
        inert={open}
        tabIndex={open ? -1 : 0}
        type="button"
        onClick={onOpen}
        initial={false}
        animate={animateGeometry ? { opacity: open ? 0 : 1 } : undefined}
        transition={{ ...fade, delay: open || reduced ? 0 : 0.15 }}
        style={{ opacity: animateGeometry ? undefined : open ? 0 : 1, pointerEvents: open ? "none" : "auto" }}
      >
        {presence === "complete" ? <CheckIcon size={16} /> : presence === "approval" || presence === "error" ? <WarningCircleIcon size={16} /> : <ArrowUpIcon className="workspace-assistant-arrow" size={16} />}
        <span>{label}</span>
      </motion.button>
    </div>
    {open && resizable && onResize ? <AssistantWindowResize
      bounds={{ left: fullGeometry.inset, top: viewport.viewportHeight - fullGeometry.bottom - fullGeometry.height, right: viewport.viewportWidth - fullGeometry.inset, bottom: viewport.viewportHeight - fullGeometry.bottom }}
      readRect={() => {
        const rect = shellRef.current!.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }}
      onStart={stopResizeMotion}
      onChange={updateRect}
      onCommit={onResize}
    /> : null}
  </motion.div>;
}
