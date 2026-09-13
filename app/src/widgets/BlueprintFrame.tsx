/**
 * [INPUT]: 依赖 ReactNode 与 landing.css 的共享主轨宽度、视口外轨坐标和局部导轨颜色
 * [OUTPUT]: 对外提供承载连续导轨、自定义宽度 className 与可选 fullBleed 外轨的 BlueprintFrame
 * [POS]: widgets 的 Landing 纵向骨架；导航、1120px 正文与页脚共用坐标，页面区块仅承载内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ReactNode } from "react";

type BlueprintFrameProps = {
  children: ReactNode;
  className?: string;
  fullBleed?: boolean;
};

export function BlueprintFrame({
  children,
  className = "",
  fullBleed = false,
}: BlueprintFrameProps) {
  return (
    <div
      className={["blueprint-frame", className].join(" ")}
      data-full-bleed={fullBleed || undefined}
    >
      <div aria-hidden="true" className="blueprint-rails">
        {fullBleed ? (
          <>
            <span className="blueprint-rail blueprint-rail-edge-start" />
            <span className="blueprint-rail blueprint-rail-edge-end" />
          </>
        ) : null}
        <span className="blueprint-rail blueprint-rail-start" />
        <span className="blueprint-rail blueprint-rail-end" />
      </div>
      {children}
    </div>
  );
}
