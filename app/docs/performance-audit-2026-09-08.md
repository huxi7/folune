# APP + API 性能优化验收（单一批次）

这是同一轮性能优化任务的完整记录，不是第二轮。前一段执行在上下文窗口耗尽后暂停；恢复上下文后补做了验收、GEB 对齐，以及同一批次内两个低风险收尾优化。范围是 APP 启动、目录/正文、搜索、Canvas 与 API 传输/保存。未修改 Chat、AI 消息处理、数据库 schema、视觉样式或动画参数。基线为 `c36a56c`，测量日期 2026-09-08。

## 这次实际改了哪些文件

- 首屏与路由：`app/src/app/router/index.tsx`、`app/src/pages/useAppDashboardController.ts`、`app/src/pages/appDashboardTypes.ts`、`app/src/pages/workspacePreload.ts`、`app/src/pages/useMemoDocumentPreload.ts`。
- 正文与目录状态：`app/src/shared/store/memoDocumentStore.ts`、`app/src/shared/store/memoTree.ts`、`app/src/shared/store/memoTreeStore.ts`。
- 搜索、文件树与 Canvas：`app/src/widgets/useMemoSearch.ts`、`app/src/widgets/WorkspaceCommandPalette.tsx`、`app/src/widgets/AppSidebar.tsx`、`app/src/widgets/KnowledgeCanvas/KnowledgeCanvas.tsx`。
- API 认证、传输与保存：`api/src/service/auth.service.ts`、`api/src/app.ts`、`api/src/service/memo.service.ts`。
- 对应测试和 CLAUDE/GEB 地图同步更新，未触碰 `chat/`。

## 链路与取舍

当前入口是浏览器会话 → Profile 准入 → Dashboard → 轻量 tree → 当前正文。API 每次经 Supabase Auth 验证，再携带用户 JWT 调用 PostgREST/RPC；业务数据不经过浏览器 Supabase SDK。正文 Store 与 tree 分离，Canvas 经 IndexedDB WAL → Coordinator → 原子 mutation 保存。

| 环节 | 发现 | 本次处理 |
| --- | --- | --- |
| 首次进入 APP | Dashboard 的 React.lazy 到 Profile loader 结束后才开始下载 | 使用 Router lazy，代码与静态身份 loader 并行；仍由 Profile 决定准入 |
| 首屏资源 | 编辑器、Markdown、React/Motion 的体积仍大 | 对照默认自动拆包后未发现明确整体收益，保留原 CodeMirror 分包；不通过延迟挂载编辑器破坏首帧或选区 |
| 正文获取 | 只有“预取后点击”共享请求；点击后预取和同时打开会重复 | 统一在途读取，消费者独立取消，最后一人取消才终止传输；删除/reset 使旧响应失效，已有草稿不被读取覆盖 |
| 弱网预取 | 空闲 CPU 不代表空闲网络，相邻正文和 Canvas 代码可能争抢带宽 | 正文等当前文档就绪；相邻正文与 Canvas 代码预热共用在线/前台/省流/慢网策略；主动打开不受限 |
| 树状态 | shift/unshift 查询频繁搬动数组，删除与排序重建无关节点 | 查询改为线性栈；保持排序、插入和删除中未变子树引用；当前节点按 tree/路由身份缓存 |
| 搜索 | 关闭的搜索面板仍生成结果；树更新使同一正文查询重新请求；命中回填对每个 ID 重复遍历树 | 关闭时跳过结果计算；查询结果和当前树过滤分离，保存/重命名不重发同一查询；当前树只建立一次 ID 集合 |
| 文件库 FLIP 判据 | 标题/摘要更新也会递归拼接整棵树结构键 | 按不可变节点与子数组引用缓存结构键，只有树形关系变化才重算变更路径 |
| Canvas | 每次渲染重新生成初始化全图，更新时又重复投影 | 初始化 Flow 只生成一次；首帧和更新共用按文档引用缓存的投影，React Flow 仍独占选择 |
| API 传输 | 默认跨域预检复用时间短，正文/目录/图未压缩 | CORS maxAge=600；memo-tree、memos、canvases 响应使用 Hono gzip/deflate 协商，Vary 保留 Accept-Encoding |
| 自动保存 | 完整替换正文前先下载旧正文，随后直接丢弃 | 先验证 owner/type 节点，再写新正文；少一次 PostgREST 读取。标题单独更新仍返回原正文，正文先写、标题后写的冲突语义保持 |
| 权限与持久化 | 当前 owner/RLS、命名索引、WAL 已承担一致性 | 保留鉴权、写入顺序与失败恢复；没有加入过期身份缓存、自动重试写入或草稿淘汰 |

## 证据

### 确定性验证

- APP：507 tests 通过；typecheck、lint、生产 build 通过。
- API：109 tests 通过；typecheck 通过。包括 owner 隔离、正文空白保真、标题冲突但正文已保存、Canvas version/原子写入契约。
- 覆盖内容：双向读取合并、多消费者取消、取消后重开、删除后迟到响应、草稿保护、树引用保留、搜索树变化不重发、弱网预取、CORS 来源限制、gzip 解压逐字相等，以及文件树结构键和正文命中 ID 索引的回归路径。
- Canvas 既有真实组件测试验证选择、Panel 开合、自由文字编辑、删除与退出保存；未以禁用动画换性能。

### 本地基线对照

运行时 Bun 1.3.14；旧实现取自 `c36a56c`。一万根节点查找最后节点，预热 5 次、21 组各 20 次，报告组均值中位数。引用测试用 100 个文件夹、每个 100 个叶子。

| 项目 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 一万节点末尾查找 | 0.652 ms | 0.067 ms |
| 删除一个叶子后变化的顶层分支引用 | 100 | 1 |
| 对已排序树再排序后变化的顶层分支引用 | 100 | 0 |
| 点击 → 预取 → 再次打开同一未完成正文 | 3 次请求 | 1 次请求 |
| 仅正文保存的上游调用（包含 Auth） | 4 次 | 3 次 |

通过真实 Hono router/service/repository 与内存 Supabase fixture 测量：1000 篇合成笔记的轻量 tree，未压缩 658,704 bytes，gzip 16,315 bytes，解压逐字一致。该数字反映这个具有重复 JSON 结构的测试样本，不代表所有用户数据的压缩率，也不等于端到端提速比例。

### 登录态浏览器检查

本机 `localhost:10000` 开发服务连接现有 API，在独立临时标签页施加 CPU 4 倍降速、150 ms 延迟、下载 128 KB/s、上传 64 KB/s 条件：笔记首次打开、切换、缓存返回和现有 Canvas 打开成功；缓存返回同一正文零网络请求。实际正文响应为 200/gzip，观察到未缓存正文响应头等待约 0.96–1.58 秒；这些是修改后的样本，没有据此宣称整站前后端加速百分比。浏览器控制调用耗时不作为页面耗时。

开发态含 HMR、模块请求和热缓存，不能代替生产冷启动 LCP/INP 测量。测试没有编辑真实笔记或触发 AI；写入与失败恢复通过隔离测试完成。浏览器模拟不是低端实体设备的帧率验收。

## 仍然存在的上限

- API 到 Supabase Auth/PostgREST 的地理距离、网络波动和串行准入仍决定首次读取下限。gzip 主要减少下载时间，不能减少数据库等待；本次没有弱化鉴权。
- tree 仍是全量结构读取与渲染；数据规模扩大后需要结合真实数据库查询计划、PostgREST 行数上限和用户树形态决定分页/虚拟化，不能仅凭合成微测更改协议。本次没有远端 SQL 执行计划证据，未修改索引或迁移。
- 正文缓存保留本地草稿，没有安全淘汰所需的“已保存/仍被引用”完整生命周期；不为限制内存而冒险丢稿。极长文档、超大 Canvas 仍受解析、布局与 DOM 数量限制。
- 生产构建仍有大于 500 kB 的 chunk 和既有 Mastra 浏览器兼容提示；没有把拆成更多文件误报为下载总量降低。Chat 与其依赖不在本次优化范围。
- Network Information 并非所有浏览器都提供，缺失时保留在线前台预取；主动加载始终可用。

实现依据核对：[React Router 静态 loader 与 lazy 并行](https://github.com/remix-run/react-router/blob/main/decisions/0002-lazy-route-modules.md)、[Hono CORS](https://hono.dev/docs/middleware/builtin/cors)、[Hono 压缩](https://hono.dev/docs/middleware/builtin/compress)。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
