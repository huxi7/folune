/**
 * [INPUT]: 依赖 React 本地编辑状态与上层的重命名命令；不再读取 canvas_kind/origin_node_id
 * [OUTPUT]: 对外提供 Canvas 顶层安静标题：任何画布都能就地重命名，零特例
 * [POS]: KnowledgeCanvas 的画布身份表现层；不绘制卡片表面、不持有树事务，重命名交回上层，长标题截断并以 tooltip 给出全名。回到来源笔记不在这里——它是画布上那张 memo_ref 卡片的职责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";

type CanvasTitleProps = {
  onRename: (title: string) => Promise<void>;
  title: string;
};

/*
 * 默认 Canvas 与 standalone Canvas 共用这一个分支。它们曾经是两种标题——默认
 * Canvas 的标题是只读的「回到原文」按钮，因为那时它的名字必须等于来源笔记。
 * 命名权归还之后，来源笔记只由画布上那张 memo_ref 卡片表达（删掉它，画布就
 * 自动转为 standalone），标题这块地因此只做一件事: 改名。
 */
export function CanvasTitle({ onRename, title }: CanvasTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

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
