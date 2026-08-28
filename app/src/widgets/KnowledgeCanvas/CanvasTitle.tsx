/**
 * [INPUT]: 依赖 canvasWorkspaceStore 的 canvas_kind/origin_node_id、React 本地编辑状态与上层的打开原文/重命名命令
 * [OUTPUT]: 对外提供 Canvas 顶层安静标题：默认 Canvas 的标题是回到来源笔记的入口且只读，独立 Canvas 的标题可原地重命名
 * [POS]: KnowledgeCanvas 的画布身份表现层；不绘制卡片表面、不持有树事务，重命名与导航都交回上层，长标题截断并以 tooltip 给出全名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";

import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";

type CanvasTitleProps = {
  /** 默认 Canvas 的标题就是它的来源笔记，点击即带着返回描述回到原文 */
  onOpenOrigin: (memoId: string) => void;
  onRename: (title: string) => Promise<void>;
  title: string;
};

export function CanvasTitle({ onOpenOrigin, onRename, title }: CanvasTitleProps) {
  const canvas = useCanvasWorkspaceStore((state) => state.document?.canvas ?? null);
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const originNodeId = canvas?.canvas_kind === "memo_default"
    ? canvas.origin_node_id
    : null;

  useEffect(() => {
    if (draft === null) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [draft !== null]);

  const commit = () => {
    if (draft === null || committingRef.current) return;
    const next = draft.trim();
    committingRef.current = true;
    setDraft(null);
    if (next.length > 0 && next !== title) {
      void onRename(next).finally(() => {
        committingRef.current = false;
      });
      return;
    }
    committingRef.current = false;
  };

  if (draft !== null) {
    return (
      <input
        aria-label="画布名称"
        className="canvas-title-input nodrag"
        maxLength={500}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
        ref={inputRef}
        value={draft}
      />
    );
  }

  if (originNodeId !== null) {
    return (
      <button
        className="canvas-title"
        data-role="origin"
        onClick={() => onOpenOrigin(originNodeId)}
        title={`${title} · 回到原文`}
        type="button"
      >
        {title}
      </button>
    );
  }

  return (
    <button
      className="canvas-title"
      data-role="rename"
      onClick={() => setDraft(title)}
      title={`${title} · 点击重命名`}
      type="button"
    >
      {title}
    </button>
  );
}
