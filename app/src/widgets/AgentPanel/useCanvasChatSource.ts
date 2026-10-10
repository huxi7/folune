/**
 * [INPUT]: 依赖画布 API、Canvas Store、当前笔记/画布身份与初始消息
 * [OUTPUT]: 默认引用跟随页面；显式 @独立保留；发送前同步并冻结范围
 * [POS]: AgentPanel 的画布来源生命周期；页面身份驱动默认引用，卡片点选不改问答范围
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { getCanvas, type CanvasDetail } from "../../shared/api/canvas";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";
import type { FoluneUIMessage } from "../../shared/api/ai";
import {
  freezeCanvasSource,
  restoreCanvasSource,
  type CanvasComposerSource,
} from "./canvasChatSources";

export function useCanvasChatSource({
  accessToken,
  currentCanvas,
  currentMemoId,
  initialMessages,
  prepare,
}: {
  accessToken: string;
  currentCanvas?: { id: string; title: string } | null;
  currentMemoId?: string | null;
  initialMessages: readonly FoluneUIMessage[];
  prepare?: (id: string) => Promise<void>;
}) {
  const currentId = currentCanvas ? `canvas:${currentCanvas.id}`
    : currentMemoId ? `memo:${currentMemoId}` : null;
  const [previousId, setPreviousId] = useState(currentId);
  const [explicit, setExplicit] = useState(false);
  const [source, setSource] = useState<CanvasComposerSource | null>(() => {
    const restored = restoreCanvasSource(initialMessages);
    if (currentCanvas) return restored?.id === currentCanvas.id
      ? { ...restored, title: currentCanvas.title }
      : { ...currentCanvas, mode: "all", memoIds: [] };
    return currentMemoId ? null : restored;
  });
  const [remote, setRemote] = useState<CanvasDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [retry, setRetry] = useState(0);
  // === 页面默认来源 ===
  // 同步更换来源，避免旧画布在子组件中继续压住当前笔记。
  // 空来源也保留到离开本页；只有显式 @可跨页面继续引用。
  if (previousId !== currentId) {
    setPreviousId(currentId);
    if (!explicit) {
      setSource(currentCanvas ? { ...currentCanvas, mode: "all", memoIds: [] } : null);
      setError(null);
    }
  } else if (source && source.id === currentCanvas?.id && source.title !== currentCanvas.title) {
    setSource({ ...source, title: currentCanvas.title });
  }
  const local = useCanvasWorkspaceStore((s) => s.document);
  const sessionId = useCanvasWorkspaceStore((s) => s.canvasId);
  const selection = useCanvasWorkspaceStore((s) => s.selectedNodeIds);
  const sourceId = source?.id;
  useEffect(() => {
    if (!sourceId || sessionId === sourceId) return;
    const controller = new AbortController();
    setError(null);
    void getCanvas(accessToken, sourceId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setRemote(detail);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "画布读取失败。");
      });
    return () => controller.abort();
  }, [accessToken, sessionId, sourceId, retry]);
  const detail = source
    ? sessionId === source.id
      ? local
      : remote?.canvas.node_id === source.id
        ? remote
        : null
    : null;
  const selectedMemos =
    sessionId === source?.id
      ? (detail?.nodes ?? [])
          .filter(
            (n) => selection.includes(n.id) && n.target && !n.target.deleted_at,
          )
          .map((n) => n.target_node_id!)
      : [];
  return {
    source,
    detail,
    error,
    preparing,
    selectedMemos,
    setSource,
    remove: () => {
      setExplicit(false);
      setSource(null);
      setError(null);
    },
    retry: () => setRetry((v) => v + 1),
    select: (id: string, title: string) => {
      setExplicit(true);
      setSource({ id, title, mode: "all", memoIds: [] });
      setError(null);
    },
    freeze: async () => {
      if (!source) return undefined;
      setPreparing(true);
      setError(null);
      try {
        await prepare?.(source.id);
        const fresh = await getCanvas(accessToken, source.id);
        setRemote(fresh);
        return freezeCanvasSource(source, fresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : "画布尚未同步。");
        throw e;
      } finally {
        setPreparing(false);
      }
    },
  };
}
