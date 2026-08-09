/**
 * [INPUT]: 无运行时依赖，描述备忘录正文的视图状态边界
 * [OUTPUT]: 对外提供 DocumentView 与 EditingMode 联合类型
 * [POS]: app/src/widgets 的 Markdown 视图状态协议，被工作台、菜单与编辑器共同消费，避免把阅读状态误建模为第三种编辑模式
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type DocumentView = "editing" | "reading";
export type EditingMode = "live" | "source";
