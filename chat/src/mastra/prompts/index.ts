/**
 * [INPUT]: 依赖 ./memo-agent 的系统提示词资产
 * [OUTPUT]: 对外提供 prompts 子域的稳定导出 memoAgentPrompt
 * [POS]: prompts 子域出口，只负责隔离调用方与提示词文件布局，不承载提示词正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export { memoAgentPrompt } from "./memo-agent";
