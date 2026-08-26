/**
 * [INPUT]: 依赖 Canvas V2 节点与候选置信度/稳定 memo ID
 * [OUTPUT]: 对外提供不移动旧节点的 24 角度、320..960 半径、32px 安全区增量布局
 * [POS]: pages 的 Canvas 空间生长纯策略；人工上下文添加与 AI expansion 共用，几何不进入 React 组件或模型提示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CanvasNode } from "../shared/api/canvas";
import {
  CANVAS_MEMO_HEIGHT,
  CANVAS_MEMO_WIDTH,
  CANVAS_TEXT_HEIGHT,
  CANVAS_TEXT_WIDTH,
} from "./canvasPresentation";

export type CanvasLayoutCandidate = {
  confidence: number;
  memoId: string;
};

export type CanvasLayoutPosition = {
  memoId: string;
  x: number;
  y: number;
};

export const nearestCanvasPlacement = (
  nodes: readonly CanvasNode[],
  center: { x: number; y: number },
): { x: number; y: number } => {
  const occupied = nodes.map(nodeRect);
  let best: { rect: Rect; score: number } | null = null;

  for (let radius = 0; radius <= MAX_RADIUS; radius += RADIUS_STEP) {
    for (let step = 0; step < ANGLE_COUNT; step += 1) {
      const angle = step * Math.PI * 2 / ANGLE_COUNT;
      const rect: Rect = {
        height: CANVAS_MEMO_HEIGHT,
        width: CANVAS_MEMO_WIDTH,
        x: center.x + Math.cos(angle) * radius - CANVAS_MEMO_WIDTH / 2,
        y: center.y + Math.sin(angle) * radius - CANVAS_MEMO_HEIGHT / 2,
      };
      const score = occupied.reduce(
        (sum, current) => sum + overlapArea(expanded(rect), expanded(current)),
        0,
      );
      if (score === 0) return { x: rect.x, y: rect.y };
      if (best === null || score < best.score) best = { rect, score };
    }
  }

  return best === null
    ? { x: center.x, y: center.y }
    : { x: best.rect.x, y: best.rect.y };
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CLEARANCE = 32;
const ANGLE_COUNT = 24;
const START_RADIUS = 320;
const RADIUS_STEP = 80;
const MAX_RADIUS = 960;

const nodeRect = (node: CanvasNode): Rect => ({
  height: node.kind === "memo_ref"
    ? CANVAS_MEMO_HEIGHT
    : node.height ?? CANVAS_TEXT_HEIGHT,
  width: node.kind === "memo_ref"
    ? CANVAS_MEMO_WIDTH
    : node.width ?? CANVAS_TEXT_WIDTH,
  x: node.x,
  y: node.y,
});

const centerOf = (rect: Rect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

const expanded = (rect: Rect): Rect => ({
  height: rect.height + CLEARANCE * 2,
  width: rect.width + CLEARANCE * 2,
  x: rect.x - CLEARANCE,
  y: rect.y - CLEARANCE,
});

const overlapArea = (left: Rect, right: Rect): number => {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width)
      - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height)
      - Math.max(left.y, right.y),
  );
  return width * height;
};

const normalizedAngle = (radians: number): number => {
  const tau = Math.PI * 2;
  return ((radians % tau) + tau) % tau;
};

const inheritedAngle = (
  nodes: readonly CanvasNode[],
  source: CanvasNode,
): number | null => {
  if (source.discovered_from_id === null) return null;
  const parent = nodes.find((node) => node.id === source.discovered_from_id);
  if (parent === undefined) return null;
  const from = centerOf(nodeRect(parent));
  const to = centerOf(nodeRect(source));
  if (from.x === to.x && from.y === to.y) return null;
  return normalizedAngle(Math.atan2(to.y - from.y, to.x - from.x));
};

const largestFreeSectorAngle = (
  occupied: readonly Rect[],
  source: Rect,
): number => {
  const sourceCenter = centerOf(source);
  const used = occupied
    .filter((rect) => {
      const center = centerOf(rect);
      return center.x !== sourceCenter.x || center.y !== sourceCenter.y;
    })
    .map((rect) => {
      const center = centerOf(rect);
      return normalizedAngle(Math.atan2(
        center.y - sourceCenter.y,
        center.x - sourceCenter.x,
      ));
    })
    .sort((left, right) => left - right);

  if (used.length === 0) return 0;

  let bestGap = -1;
  let bestAngle = 0;
  for (let index = 0; index < used.length; index += 1) {
    const start = used[index]!;
    const end = index === used.length - 1
      ? used[0]! + Math.PI * 2
      : used[index + 1]!;
    const gap = end - start;
    if (gap > bestGap) {
      bestGap = gap;
      bestAngle = normalizedAngle(start + gap / 2);
    }
  }
  return bestAngle;
};

const candidateRect = (
  source: Rect,
  angle: number,
  radius: number,
): Rect => {
  const center = centerOf(source);
  return {
    height: CANVAS_MEMO_HEIGHT,
    width: CANVAS_MEMO_WIDTH,
    x: center.x + Math.cos(angle) * radius - CANVAS_MEMO_WIDTH / 2,
    y: center.y + Math.sin(angle) * radius - CANVAS_MEMO_HEIGHT / 2,
  };
};

export const layoutCanvasCandidates = (
  nodes: readonly CanvasNode[],
  sourceNodeId: string,
  candidates: readonly CanvasLayoutCandidate[],
): CanvasLayoutPosition[] => {
  const source = nodes.find((node) => node.id === sourceNodeId);
  if (source === undefined) return [];

  const occupied = nodes.map(nodeRect);
  const sourceRect = nodeRect(source);
  const baseAngle = inheritedAngle(nodes, source)
    ?? largestFreeSectorAngle(occupied, sourceRect);
  const sorted = [...candidates].sort((left, right) =>
    right.confidence - left.confidence || left.memoId.localeCompare(right.memoId));
  const positions: CanvasLayoutPosition[] = [];

  for (let candidateIndex = 0; candidateIndex < sorted.length; candidateIndex += 1) {
    const candidate = sorted[candidateIndex]!;
    let best: { rect: Rect; score: number } | null = null;

    for (
      let radius = START_RADIUS;
      radius <= MAX_RADIUS;
      radius += RADIUS_STEP
    ) {
      for (let step = 0; step < ANGLE_COUNT; step += 1) {
        const alternatingOffset = step === 0
          ? 0
          : Math.ceil(step / 2) * (Math.PI * 2 / ANGLE_COUNT) * (step % 2 === 0 ? -1 : 1);
        const angle = baseAngle
          + alternatingOffset
          + candidateIndex * (Math.PI * 2 / ANGLE_COUNT);
        const rect = candidateRect(sourceRect, angle, radius);
        const score = occupied.reduce(
          (sum, current) => sum + overlapArea(expanded(rect), expanded(current)),
          0,
        );

        if (score === 0) {
          best = { rect, score };
          break;
        }
        if (best === null || score < best.score) best = { rect, score };
      }
      if (best?.score === 0) break;
    }

    if (best === null) continue;
    occupied.push(best.rect);
    positions.push({
      memoId: candidate.memoId,
      x: Math.round(best.rect.x * 100) / 100,
      y: Math.round(best.rect.y * 100) / 100,
    });
  }

  return positions;
};
