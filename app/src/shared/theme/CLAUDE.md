# app/src/shared/theme/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留全局主题目录
CLAUDE.md: 记录主题状态层职责与文档协议
ThemeProvider.tsx: 全局主题 Provider 与 useTheme hook，持久化 system/light/dark 用户偏好、监听系统外观变化并向 Markdown 编辑器暴露解析后的 light/dark 结果

职责: 浏览器端全局主题状态边界；system 只负责解析为 light/dark，不增加第三套颜色主题，也不定义颜色值，所有视觉 token 继续以 app/src/index.css 为唯一真相源。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
