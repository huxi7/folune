/**
 * [INPUT]: 依赖 ReactNode 与 landing.css 的浅色 RailLayer、全宽外轨和主内容内轨几何规则
 * [OUTPUT]: 对外提供承载连续导轨、自定义宽度 className 与可选 fullBleed 外轨的 BlueprintFrame
 * [POS]: app/src/widgets 的 Landing 蓝图结构骨架，被 LandingPage 用于全宽 Header/公告和 1088px 正文，Footer 与其解耦
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
