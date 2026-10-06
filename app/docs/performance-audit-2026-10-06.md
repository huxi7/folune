# Folune 性能与稳定性检查 · 2026-10-06

> L2 | 父级: ./CLAUDE.md

检查基线为 `main` 的 `32545e3db5fda6c3f7dfb66921ed3503c9f2e130` 加当时已有的 Landing 视觉改动。检查范围覆盖 APP、API、Chat、Electron 桌面宿主；修复集中在能用调用链和故障注入验证的问题。既有 Landing 变更保留，未部署生产、未执行真实支付或付费模型调用。

## 已修复的问题

| 路径 | 根因与用户影响 | 修复 |
| --- | --- | --- |
| `src/shared/store/canvasDocument.ts` | 同批操作跨过删除/重建合并，快速删除→撤销可能仍把关系删除，或丢失文字/坐标；每个节点更新线性扫描累计列表 | 按生命周期隔断索引，保留首次关系身份与未显式清除的理由；用节点索引替代重复扫描 |
| `src/shared/store/CanvasSaveCoordinator.ts` | IndexedDB 恢复读未进入写锁，旧恢复结果覆盖恢复期间新手势；离场后异步保存/恢复/冲突响应仍写共享 Store | 恢复和手势共享 WAL 锁；每个异步边界隔离已结束会话，停止后续重试；不确定请求保留同 ID WAL 供下次重放 |
| `../../chat/src/routes/chat-stream.ts` | AI SDK 续写继承上次消息 metadata，本次失败或取消时可能重复上报旧 token | 用量只取当前模型 finish；失败 finish 带来的实际 token 仍记录 |
| `../../chat/src/routes/canvas-expand.ts` | 完整 checkpoint、零候选或空正文跳过模型后仍固定扣积分 | 记账移到实际模型判断完成处；后续引文复核失败仍记录已执行判断 |
| `../../api/src/service/auth.service.ts`、`../../chat/src/middleware/auth.ts` | 过期缓存只有相同 token 再访问才清理，token 轮换后无界累积；Chat 并发请求重复验证 | 两端保持 45 秒 TTL，增加 1024 项上限和过期回收；Chat 同 token 请求合并，一个请求取消不影响其余等待者 |
| `../../api/src/lib/supabase-storage.ts` | 对象上传/删除裸 fetch，响应头到达后 body 仍可能一直挂起 | 复用 Auth/PostgREST 的完整 HTTP 生命周期，写请求 12 秒期限且不重放，外部错误净化 |
| `../../api/src/service/profile.service.ts` | 旧头像删除成功但响应丢失时回滚到已删除 URL；更新已提交但响应丢失时误删新头像 | 提交后的旧对象清理失败不回滚；更新结果未知时只读确认，无法确认则保留可能被引用的对象 |
| `../package.json`、`../../api/package.json` | 测试共享全局 DOM、Motion 状态、模块替身和冻结环境配置，出现单跑通过、合跑失败 | 官方入口 `bun run test` 使用 `bun test --isolate`；preload 每文件重跑，测试不依赖顺序 |
| `src/pages/workspaceMotion.test.ts` | 背景已抽取为语义变量，测试仍只接受旧字面声明 | 同时验证变量的 85% 颜色定义与实际消费，保留原过渡语义 |
| `src/widgets/LandingHeroLab/Controls.tsx` | 方案按钮缺少静态可识别的名称，触发 a11y 检查警告 | 编号与名称作为明确的可访问名称，视觉和交互不变 |

## 性能证据

`normalizeCanvasIntents` 对比 Git 基线与修复后函数。每个节点连续 5 次坐标编辑，7 次预热、21 次采样取中位数，本机 Bun 1.3.14。脚本保留于本次机器临时目录 `/tmp/folune-canvas-normalize-benchmark.ts`。

| 节点数 | 输入操作数 | 旧中位数 | 新中位数 |
| ---: | ---: | ---: | ---: |
| 100 | 500 | 0.154 ms | 0.065 ms |
| 1,000 | 5,000 | 9.817 ms | 0.479 ms |
| 5,000 | 25,000 | 233.824 ms | 2.206 ms |

这是纯函数合成基准，不代表真实画布 FPS、网络响应或低端设备体验。改动减少与节点数量相关的重复工作；未通过减少动画或改变持久化协议获取收益。

Vite manifest 递归统计 `index.html` 静态 JS 依赖，修复前后均为 617,944 bytes（约 200.8 KB gzip）。只统计入口静态依赖，不含路由追加块、CSS、字体、图片与 demo iframe。构建仍有约 502 KB 的公共 `locale` chunk 警告；文件名不代表只有语言数据，应以模块分析和真实加载轨迹决定后续拆包。此次没有声称首屏加载性能已提升。

## 验证

- APP：`bun run test`，809 passed / 0 failed，134 文件、7,351 assertions；`bun run typecheck`、`bun run lint` 通过，无 lint 警告。
- API：`bun run typecheck`、`bun run test --only-failures`，188 passed / 0 failed，15 文件、925 assertions。
- Chat：`bun run typecheck`、`bun test --only-failures`，94 passed / 0 failed，18 文件、498 assertions；`bun run build` 构建成功。
- Desktop：`npm test`，4 passed / 0 failed。未启动或制作原生安装包。
- APP 生产构建通过，产物写到 `/tmp/folune-audit-build-final`，不覆盖工作区正式产物；仍保留上述大 chunk 提示。
- 故障回归覆盖 Canvas 删除撤销、恢复并发、离场迟到响应、退避与两类冲突、稳定 mutation 重放；Chat 本轮计费与并发认证；Storage body 超时、断连、头像不确定提交。
- 本机浏览器：首页、公开价格数据正常呈现；工作区未登录跳到登录页，登录后文件树与编辑器就绪，未编辑用户笔记或触发 AI。API `10001/health` 与 Chat `10002/health` 均 HTTP 200。
- 四模块共 1,095 项测试通过。`git diff --check` 通过，相关 L3/L2 同步，根地图已检查，模块边界未改变。
- 独立交叉审阅 Canvas 合并与保存差异，复跑相关回归。另检查同画布跨实例草稿时序：可控替身的任意乱序未映射到真实 IndexedDB 同库连接/事务队列，因此未加入缺少证据的全局锁。
- 工作区仍包含任务开始前的 Landing 变更，全部保留；本轮修复未提交，未推送。

## 保留的边界

1. Canvas / organize / explore 仍沿用既有估算 token 计费；本次修复“没有执行模型也扣费”，未替换完整计量协议。Chat 未收到 usage finish 时也无法凭空取得精确 token。
2. Storage 提交无法确认或旧文件清理失败时，可能保留孤儿对象；优先避免删除用户当前头像，未引入后台垃圾回收。
3. Canvas 测试使用可控 Promise 与内存 WAL，未进行浏览器磁盘损坏、跨标签并发和崩溃压力验收；生产持久化仍经 IndexedDB、Coordinator 和唯一 API mutation 边界。
4. 模块健康、登录和测试通过不等于真实模型首 token、画布 FPS 或生产部署通过。生产发布、真实付款和真实模型调用均不在本次已验证结果内。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
