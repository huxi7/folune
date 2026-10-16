# app/src/shared/theme/
> L2 | 父级: ../CLAUDE.md

成员清单
visualContext.ts: 已提交路由到根级 APP/marketing 视觉场景的唯一运行期映射，工作区及 /design-system 共用 APP 场景并覆盖 body Portal；营销始终浅色，APP 恢复根节点的已解析偏好；同步调用纯文档语言策略，不改用户存储
visualContext.test.ts: 首绘与运行期映射一致性、Design System 浅暗/系统偏好及根级 Portal 场景、往返恢复、存储异常与独立 Demo 作用域门禁
.gitkeep: 保留全局主题目录
CLAUDE.md: 记录主题状态层职责与文档协议
ThemeProvider.tsx: 全局主题 Provider 与 useTheme hook，持久化 system/light/dark 用户偏好、监听系统外观变化，通过 visualContext 按场景应用外观并向 Markdown 编辑器暴露解析后的 light/dark 结果

职责: 浏览器端全局主题状态边界；system 只负责解析为 light/dark，不增加第三套颜色主题，也不定义颜色值，全局默认 token 归 index.css，APP 场景颜色与排版角色归 styles/app-visual.css；本目录只同步主题及场景标记。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
