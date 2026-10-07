/**
 * [INPUT]: 依赖画布 API、现有 Canvas Store 与当前消息来源
 * [OUTPUT]: 提供当前画布默认引用、来源切换及发送前同步冻结
 * [POS]: AgentPanel 的画布来源生命周期；不写画布，也不跟随卡片点选漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
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
  initialMessages,
  prepare,
  hasDraft,
}: {
  hasDraft?: boolean;
  accessToken: string;
  currentCanvas?: { id: string; title: string } | null;
  initialMessages: readonly FoluneUIMessage[];
  prepare?: (id: string) => Promise<void>;
}) {
  const [source, setSource] = useState<CanvasComposerSource | null>(
    () =>
      restoreCanvasSource(initialMessages) ??
      (currentCanvas ? { ...currentCanvas, mode: "all", memoIds: [] } : null),
  );
  const [remote, setRemote] = useState<CanvasDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [retry, setRetry] = useState(0);
  const dismissed = useRef(false);
  const local = useCanvasWorkspaceStore((s) => s.document);
  const sessionId = useCanvasWorkspaceStore((s) => s.canvasId);
  const selection = useCanvasWorkspaceStore((s) => s.selectedNodeIds);
  useEffect(() => {
    if (!source && !dismissed.current && !hasDraft && currentCanvas)
      setSource({ ...currentCanvas, mode: "all", memoIds: [] });
  }, [currentCanvas, hasDraft, source]);
  const sourceId = source?.id;
  useEffect(() => {
    if (!sourceId || sessionId === sourceId) return;
    const controller = new AbortController();
    setError(null);
    void getCanvas(accessToken, sourceId, controller.signal)
      .then(setRemote)
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
      dismissed.current = true;
      setSource(null);
    },
    retry: () => setRetry((v) => v + 1),
    select: (id: string, title: string) => {
      dismissed.current = false;
      setSource({ id, title, mode: "all", memoIds: [] });
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
