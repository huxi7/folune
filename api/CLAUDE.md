# api/
> L1 | 父级: ../CLAUDE.md

业务接口服务模块，负责承载产品业务 API、数据访问与 Supabase 集成边界。

技术栈: Bun + Hono + TypeScript + zod + Supabase client。

成员清单
src/router/: 路由装配层，预留业务接口聚合边界
src/api/: API 入口层，预留资源级 HTTP 处理边界
src/dto/: 数据传输对象层，预留请求与响应契约边界
src/model/: 业务模型层，预留领域实体与值对象边界
src/service/: 应用服务层，预留业务用例编排边界
src/repository/: 数据仓储层，预留 Supabase 数据访问边界
src/middleware/: 中间件层，预留请求横切能力边界
src/common/: 通用层，预留共享类型、常量、错误语义边界
src/config/: 配置层，预留环境变量与服务配置边界
src/lib/: 基础库适配层，预留外部 SDK 与基础设施封装边界
package.json: Bun 包元数据与业务接口服务依赖清单
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 编辑器与编译约束
.gitignore: api 模块忽略规则

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
