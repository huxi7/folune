/**
 * [INPUT]: 依赖同目录 KnowledgeCanvas 组件
 * [OUTPUT]: 对外提供 KnowledgeCanvas 稳定出口
 * [POS]: KnowledgeCanvas 模块出口，隔离 WorkspaceAuxViews 与内部文件布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { KnowledgeCanvas } from "./KnowledgeCanvas";
