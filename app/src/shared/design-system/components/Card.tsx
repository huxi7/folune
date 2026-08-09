/**
 * [INPUT]: 依赖 React 的 HTMLAttributes，依赖 index.css 暴露的 ds-card 微拟物表面类
 * [OUTPUT]: 对外提供仅保留实际使用的 default、accent 表面的 Card 组件与 CardTone 类型
 * [POS]: app/src/shared/design-system/components 的表面基础件，被 Landing、NotebookPreview、NotesWorkspace 与 TrashWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { HTMLAttributes } from "react";

export type CardTone = "default" | "accent";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
};

const toneClassName: Record<CardTone, string> = {
  default: "ds-card-default",
  accent: "ds-card-accent",
};

export function Card({ children, className = "", tone = "default", ...props }: CardProps) {
  return (
    <div
      className={[
        "ds-card",
        toneClassName[tone],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
