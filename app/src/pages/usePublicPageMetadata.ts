/**
 * [INPUT]: 依赖 React effect、页面标题与摘要，以及文档已有的 title/description 节点
 * [OUTPUT]: 对外提供 usePublicPageMetadata，在公开路由切换时更新并清理页面元信息
 * [POS]: pages 的公开阅读页元信息边界；博客与法律页面共用，不触碰认证、页面布局或业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";

export function usePublicPageMetadata(title: string, description: string) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (meta) meta.content = description;
    const titleElement = document.querySelector("title");
    const previousTitle = titleElement?.textContent ?? "";
    if (titleElement) titleElement.textContent = `${title} · Folune`;
    return () => {
      if (titleElement) titleElement.textContent = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [title, description]);
}
