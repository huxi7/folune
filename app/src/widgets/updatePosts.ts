/**
 * [INPUT]: 仅依赖 landingBlogData 的 BlogPost 类型，不读取账号或远程数据
 * [OUTPUT]: 对外提供独立的产品动态集合，沿用博客文章结构，待正式内容补充
 * [POS]: widgets 的公开动态内容源；由 BlogPage 的 updates 分区消费，不混入博客或首页精选
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { BlogPost } from "./landingBlogData";

export const updatePosts: BlogPost[] = [];
