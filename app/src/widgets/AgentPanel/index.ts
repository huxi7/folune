/**
 * [INPUT]: 依赖同目录 AgentPanel 实现与会话预热控制器
 * [OUTPUT]: 对外统一导出 AgentPanel 组件及 preloadAiThreads 空闲预热入口
 * [POS]: AgentPanel 模块出口，使 AppDashboard 不依赖组件内部文件布局，同时只暴露不会挂载 UI 的数据预热能力
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { AgentPanel } from "./AgentPanel";
export { preloadAiThreads } from "./useAiThreads";
