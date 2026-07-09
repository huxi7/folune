# chat/
> L1 | 父级: ../CLAUDE.md

AI 能力服务模块，负责承载模型编排、智能代理、工作流与工具调用边界。

技术栈: Bun + Hono + TypeScript + Mastra + zod。

成员清单
src/routes/: Hono 路由层，预留 AI 能力 HTTP 入口边界
src/dto/: 数据传输对象层，预留请求与响应契约边界
src/models/: 领域模型层，预留 AI 服务内部语义模型边界
src/services/: 应用服务层，预留 AI 用例编排边界
src/mastra/: Mastra 能力层，预留 agents、workflows、tools、prompts 子域
src/middleware/: 中间件层，预留请求横切能力边界
src/config/: 配置层，预留环境变量与服务配置边界
src/common/: 通用层，预留共享类型、常量、错误语义边界
package.json: Bun 包元数据与 AI 能力服务依赖清单
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 编辑器与编译约束
.gitignore: chat 模块忽略规则

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
