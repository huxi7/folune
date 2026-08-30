/**
 * [INPUT]: 依赖稳定 Canvas 节点 ID
 * [OUTPUT]: 对外提供 Card 与 Preview 两端共享且符合 CSS custom-ident 的 View Transition 名称
 * [POS]: KnowledgeCanvas 的空间连续性命名边界；只建立视觉身份，不拥有预览状态或导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const canvasPreviewTransitionName = (nodeId: string): string =>
  `canvas-card-${nodeId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
