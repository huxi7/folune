/**
 * [INPUT]: 依赖 ArchiveCordOverlay
 * [OUTPUT]: 对外提供 ArchiveCordOverlay 单一入口
 * [POS]: app/src/widgets 的归档线导出边界；目标标记已回归真实 tree row 的 data-archive-representative，这里不再制造零尺寸中转对象，也不包裹路由或创建 source 圆圈
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { ArchiveCordOverlay } from "./ArchiveCordOverlay";
