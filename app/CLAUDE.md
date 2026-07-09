# app/
> L1 | 父级: ../CLAUDE.md

用户端模块，负责承载浏览器内的 React 体验边界。

技术栈: Bun + Vite + React + React Router + Tailwind CSS v4 + TypeScript。

成员清单
src/app/: 应用装配层，预留路由壳、全局 Provider、运行时挂载边界
src/pages/: 页面层，预留 URL 级页面模块边界
src/widgets/: 业务组合组件层，预留跨页面复用的界面单元边界
src/shared/: 前端共享层，预留 UI 基础件、工具、类型、常量边界
package.json: Bun 包元数据与用户端依赖清单
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 编辑器与编译约束
.gitignore: app 模块忽略规则

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
