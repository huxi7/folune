# SuperNote - AI Native 全栈 SaaS 工程骨架
Bun + TypeScript + Vite + React + React Router + Tailwind CSS v4 + Hono + Mastra + zod + Supabase client。

<directory>
app/ - 用户端，承载浏览器内的 React 应用骨架 (src/app, src/pages, src/widgets, src/shared)
chat/ - AI 能力服务，承载 Hono + Mastra 的智能能力边界 (src/routes, src/dto, src/models, src/services, src/mastra, src/middleware, src/config, src/common)
api/ - 业务接口服务，承载 Hono + Supabase client 的业务 API 边界 (src/router, src/api, src/dto, src/model, src/service, src/repository, src/middleware, src/common, src/config, src/lib)
</directory>

<config>
app/package.json - 用户端依赖清单与 Bun 包元数据
chat/package.json - AI 能力服务依赖清单与 Bun 包元数据
api/package.json - 业务接口服务依赖清单与 Bun 包元数据
</config>
