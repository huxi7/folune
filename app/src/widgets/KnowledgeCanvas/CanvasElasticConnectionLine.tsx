/**
 * [INPUT]: 依赖 React Flow ConnectionLineComponentProps/useStore 的 viewport transform、motion reduced-motion 与 elasticCordGeometry
 * [OUTPUT]: 对外提供 CanvasElasticConnectionLine，三股临时绳自抓手出发、终点始终咬住真实指针，末端恒定小实心珠由三股绕过，由单一 rAF 直接写 SVG 属性
 * [POS]: KnowledgeCanvas 的纯 UI 拖拽连接渲染层；不写 React 帧状态、不进 WAL，卸载立即取消唯一 rAF
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useStore, type ConnectionLineComponentProps } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import type { CordPoint } from "../cordGeometry";
import {
  ELASTIC_CORD_PARAMETERS,
  elasticCordGeometry,
} from "./elasticCordGeometry";

/*
 * 端点只有一个真相: 指针。React Flow 一旦在指针下找到合法 target handle, 就把
 * connection.to 换成那个 handle 的中心 —— 而本产品的 target handle 覆盖整张卡片,
 * 于是"任意位置松手都能连上"的代价是线被吸到卡片正中、直接贯穿正文。
 *
 * 吸附对提交是对的(它决定连给谁), 对显示是错的(它决定线画到哪)。因此这里放弃
 * toX/toY, 改用 connection.pointer: 它是容器坐标, 用 viewport transform 反解回
 * 画布坐标即可。落点感由目标卡片自己亮起来承担, 不由线去猜。
 */
const pointerInFlow = (
  pointer: { x: number; y: number } | undefined,
  transform: readonly [number, number, number],
  fallback: CordPoint,
): CordPoint => {
  if (pointer === undefined) return fallback;
  const [translateX, translateY, zoom] = transform;
  if (!Number.isFinite(zoom) || zoom === 0) return fallback;
  return {
    x: (pointer.x - translateX) / zoom,
    y: (pointer.y - translateY) / zoom,
  };
};

export function CanvasElasticConnectionLine({
  connectionStatus,
  fromX,
  fromY,
  pointer,
  toX,
  toY,
}: ConnectionLineComponentProps<CanvasFlowNode>) {
  const reducedMotion = Boolean(useReducedMotion());
  // 数组身份由 store 持有, 只在真实 pan/zoom 时变化, 因此不需要 shallow 比较
  const transform = useStore((state) => state.transform);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const cursorRef = useRef<SVGCircleElement>(null);
  const latestRef = useRef({
    connectionStatus,
    fromX,
    fromY,
    pointer,
    toX,
    toY,
    transform,
  });

  const paint = useCallback((phase: number) => {
    const latest = latestRef.current;
    const geometry = elasticCordGeometry({
      from: { x: latest.fromX, y: latest.fromY },
      phase,
      pointer: pointerInFlow(latest.pointer, latest.transform, {
        x: latest.toX,
        y: latest.toY,
      }),
    });
    geometry.strands.forEach((d, index) => {
      const path = pathRefs.current[index];
      if (path === null || path === undefined) return;
      path.setAttribute("d", d);
      path.setAttribute("stroke-width", String(geometry.width));
    });
    const cursor = cursorRef.current;
    if (cursor !== null) {
      cursor.setAttribute("cx", String(geometry.to.x));
      cursor.setAttribute("cy", String(geometry.to.y));
      // 珠子恒定且小: 状态由颜色说(valid/invalid 换 currentColor), 不靠改大小说第二遍
      cursor.setAttribute("r", "3.2");
    }
  }, []);

  useLayoutEffect(() => {
    latestRef.current = {
      connectionStatus,
      fromX,
      fromY,
      pointer,
      toX,
      toY,
      transform,
    };
    paint(reducedMotion
      ? 0
      : performance.now() * ELASTIC_CORD_PARAMETERS.phaseSpeed);
  }, [
    connectionStatus,
    fromX,
    fromY,
    paint,
    pointer,
    reducedMotion,
    toX,
    toY,
    transform,
  ]);

  useEffect(() => {
    if (reducedMotion) {
      paint(0);
      return;
    }
    let frame = 0;
    const animate = (time: number) => {
      paint(time * ELASTIC_CORD_PARAMETERS.phaseSpeed);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [paint, reducedMotion]);

  return (
    <g
      className="canvas-elastic-connection-line"
      data-status={connectionStatus ?? "pending"}
    >
      {[0, 1, 2].map((index) => (
        <path
          className="canvas-elastic-connection-strand"
          data-strand={index}
          key={index}
          ref={(element) => {
            pathRefs.current[index] = element;
          }}
        />
      ))}
      <circle className="canvas-elastic-drop-cursor" ref={cursorRef} />
    </g>
  );
}
