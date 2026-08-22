/**
 * [INPUT]: 依赖 react-archer 5.1 的 DOM 锚点/曲线/refreshScreen、React effect/ref 与 Paper First 整理展示状态
 * [OUTPUT]: 对外提供 ArchiveCordStage、Paper ArchivePort、文件树 TargetPort 与稳定 target id 映射
 * [POS]: app/src/widgets 的 Paper First Signature 连线层；react-archer 只负责几何，Run 生命周期、成功门禁与撤销语义仍由 pages 层拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArchiveIcon } from "../shared/design-system/icons";
import {
  ArcherContainer,
  ArcherElement,
  type ArcherContainerRef,
} from "react-archer";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const archiveSourceElementId = (sourceId: string): string =>
  `paper-archive-port-${sourceId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

export const archiveTargetElementId = (nodeId: string): string =>
  `archive-target-${nodeId}`;

type ArchiveCordStageProps = {
  active: boolean;
  children: ReactNode;
  refreshKey: string;
};

export function ArchiveCordStage({
  active,
  children,
  refreshKey,
}: ArchiveCordStageProps) {
  const containerRef = useRef<ArcherContainerRef>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      containerRef.current?.refreshScreen();
    });
    const settleTimers = [180, 340].map((delay) => window.setTimeout(() => {
      containerRef.current?.refreshScreen();
    }, delay));
    const refresh = () => containerRef.current?.refreshScreen();
    const mutationObserver = new MutationObserver(refresh);
    const tree = document.querySelector(".app-sidebar-tree");
    if (tree !== null) {
      mutationObserver.observe(tree, {
        attributeFilter: ["aria-expanded", "data-organize-target"],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    const resizeObserver = new ResizeObserver(refresh);
    document.querySelectorAll([
      ".workspace-floating-panel-library",
      ".paper-surface",
      ".app-sidebar-tree",
    ].join(",")).forEach((element) => resizeObserver.observe(element));

    window.addEventListener("scroll", refresh, true);
    window.addEventListener("transitionend", refresh, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("transitionend", refresh, true);
    };
  }, [active, refreshKey]);

  return (
    <ArcherContainer
      className="archive-cord-stage"
      endMarker={false}
      lineStyle="curve"
      ref={containerRef}
      startMarker={false}
      strokeColor="var(--archive-cord)"
      strokeWidth={1.35}
      svgContainerStyle={{ pointerEvents: "none", zIndex: 65 }}
    >
      {children}
    </ArcherContainer>
  );
}

type ArchivePortProps = {
  active: boolean;
  drawKey: string;
  reducedMotion: boolean;
  sourceId: string;
  targetNodeId: string | null;
};

export function ArchivePort({
  active,
  drawKey,
  reducedMotion,
  sourceId,
  targetNodeId,
}: ArchivePortProps) {
  const [relationReady, setRelationReady] = useState(false);

  useEffect(() => {
    setRelationReady(false);
    if (!active || targetNodeId === null) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => setRelationReady(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [active, sourceId, targetNodeId]);

  const relations = useMemo(() => {
    if (!active || !relationReady || targetNodeId === null) {
      return [];
    }

    const safeDrawKey = drawKey.replace(/[^a-zA-Z0-9_-]/g, "");
    return [{
      className: [
        "archive-cord-path",
        reducedMotion ? "archive-cord-path-static" : "archive-cord-path-draw",
        `archive-cord-draw-${safeDrawKey}`,
      ].join(" "),
      sourceAnchor: "left" as const,
      style: {
        endMarker: false,
        lineStyle: "curve" as const,
        startMarker: false,
        strokeColor: "var(--archive-cord)",
        strokeWidth: 1.35,
      },
      targetAnchor: "right" as const,
      targetId: archiveTargetElementId(targetNodeId),
    }];
  }, [active, drawKey, reducedMotion, relationReady, targetNodeId]);

  return (
    <ArcherElement id={archiveSourceElementId(sourceId)} relations={relations}>
      <span
        aria-label="归档连线起点"
        className="paper-archive-port"
        data-active={active}
        role="img"
      >
        <ArchiveIcon aria-hidden="true" size={14} />
      </span>
    </ArcherElement>
  );
}

export function ArchiveTargetPort({
  active,
  nodeId,
}: {
  active: boolean;
  nodeId: string;
}) {
  return (
    <ArcherElement id={archiveTargetElementId(nodeId)}>
      <span
        aria-hidden="true"
        className="archive-target-port"
        data-active={active}
      />
    </ArcherElement>
  );
}
