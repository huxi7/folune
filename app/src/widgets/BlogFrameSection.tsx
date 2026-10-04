/**
 * [INPUT]: 依赖 ReactNode、Blueprint 外侧导轨坐标，以及 blog.css 的局部框线入场样式
 * [OUTPUT]: 对外提供 BlogFrameSection；静态区承接外侧竖轨，花纹区只让外侧竖线和两段顶边先显现
 * [POS]: widgets 的公开内容分区骨架；目录、阅读与价格页共用，主内容竖轨仍由页面 BlueprintFrame 连续绘制，不参与动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ReactNode } from "react";

export function BlogFrameSection({ children, className = "", patterned = false }: {
  children: ReactNode;
  className?: string;
  patterned?: boolean;
}) {
  return <div className={`blog-frame-section ${className}`}>
    <div className="blueprint-rails blog-side-frame" data-animated={patterned || undefined} aria-hidden="true">
      <span className="blueprint-rail blueprint-rail-edge-start" />
      <span className="blueprint-rail blueprint-rail-edge-end" />
      {patterned ? <>
        <span className="blog-side-frame-top" data-side="start" />
        <span className="blog-side-frame-top" data-side="end" />
      </> : null}
    </div>
    {children}
  </div>;
}
