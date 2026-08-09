/**
 * [INPUT]: 依赖同目录 AgentPanel 实现
 * [OUTPUT]: 对外统一导出 AgentPanel 组件
 * [POS]: AgentPanel 模块出口，使 AppDashboard 不依赖组件内部文件布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { AgentPanel } from "./AgentPanel";
