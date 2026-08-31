/**
 * [INPUT]: 依赖 CanvasDetail 只读快照与浏览器内一次性路由交接生命周期
 * [OUTPUT]: 对外提供 CanvasEntryBootstrap、按 canvasId/userId/token 精确 peek/consume 且 30s 过期的短命缓存、请求解析器与同步首帧文档解析器
 * [POS]: pages 的 Paper→Canvas 数据交接边界；只跨一次客户端导航复用已经取得的 detail，不持久化、不跨用户会话、不替代 Coordinator 后续重取
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CanvasDetail } from "../shared/api/canvas";

export type CanvasEntryBootstrap = {
  canvasId: string;
  detail: CanvasDetail;
  expiresAt: number;
  sourceMemoId: string;
  token: string;
  userId: string;
};

export const CANVAS_ENTRY_BOOTSTRAP_TTL_MS = 30_000;
const bootstrapByCanvasId = new Map<string, CanvasEntryBootstrap>();

export const storeCanvasEntryBootstrap = (
  input: Omit<CanvasEntryBootstrap, "expiresAt" | "token">,
): CanvasEntryBootstrap => {
  const bootstrap = {
    ...input,
    expiresAt: Date.now() + CANVAS_ENTRY_BOOTSTRAP_TTL_MS,
    token: crypto.randomUUID(),
  };
  bootstrapByCanvasId.set(input.canvasId, bootstrap);
  return bootstrap;
};

export const peekCanvasEntryBootstrap = (
  canvasId: string,
  userId: string,
): CanvasEntryBootstrap | null => {
  const bootstrap = bootstrapByCanvasId.get(canvasId);
  if (bootstrap === undefined) return null;
  if (bootstrap.expiresAt <= Date.now()) {
    bootstrapByCanvasId.delete(canvasId);
    return null;
  }
  return bootstrap.userId === userId ? bootstrap : null;
};

export const consumeCanvasEntryBootstrap = (
  canvasId: string,
  token: string,
  userId: string,
): CanvasEntryBootstrap | null => {
  const bootstrap = peekCanvasEntryBootstrap(canvasId, userId);
  if (bootstrap === null || bootstrap.token !== token) return null;
  bootstrapByCanvasId.delete(canvasId);
  return bootstrap;
};

export const resolveInitialCanvasDetail = async (
  canvasId: string,
  userId: string,
  bootstrap: CanvasEntryBootstrap | null,
  request: () => Promise<CanvasDetail>,
): Promise<{ detail: CanvasDetail; usedBootstrap: boolean }> => {
  if (
    bootstrap?.canvasId === canvasId
    && bootstrap.userId === userId
    && bootstrap.expiresAt > Date.now()
  ) {
    return { detail: bootstrap.detail, usedBootstrap: true };
  }
  return { detail: await request(), usedBootstrap: false };
};

/*
 * View Transition 拍的是路由提交的第一帧，不会等 useEffect 把 detail 放进 Zustand。
 * 所以渲染层必须同步采用同一份 bootstrap；会话一旦建立，则只认当前 canvas 的 store
 * 文档，避免上一个 Canvas 的残留数据短暂穿进新路由。
 */
export const resolveCanvasRenderDetail = (
  canvasId: string,
  userId: string,
  sessionCanvasId: string | null,
  sessionDocument: CanvasDetail | null,
  bootstrap: CanvasEntryBootstrap | null,
): CanvasDetail | null => {
  if (sessionCanvasId === canvasId) return sessionDocument;
  if (
    bootstrap?.canvasId === canvasId
    && bootstrap.userId === userId
    && bootstrap.expiresAt > Date.now()
  ) {
    return bootstrap.detail;
  }
  return null;
};

export const clearCanvasEntryBootstrapsForTest = () => {
  bootstrapByCanvasId.clear();
};
