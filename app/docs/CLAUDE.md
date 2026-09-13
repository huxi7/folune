# app/docs/
> L2 | 父级: ../CLAUDE.md

成员清单
landing-refactor/: Figma 基线与最终 Landing 的截图、内容依据、设计取舍和两阶段验收记录
performance-audit-2026-09-08.md: APP/API 性能链路、优化取舍、隔离测试/合成基线/登录态浏览器证据与未验证上限；不将样本性能当作全站承诺
chat-performance-audit-2026-09-08.md: Chat 从面板恢复、会话即时切换/逐会话缓存、增量发送、API prepare、Mastra 流式返回到消息持久化的瓶颈、协议级改善、测试证据与外部服务上限；不将 mock 时间冒充端到端延迟
CLAUDE.md: 记录 UI 验收文档目录职责与文档协议
cord-lab.html: 连接绳形制的决策现场，五档是「波跑不跑 × 两端怎么收」两个问题的组合，可用鼠标真拖对照；内联了 2026-09-02 当时 elasticCordGeometry 的打包，故意不随后续代码更新
design-system/: Design System 语义基线、computed Token 快照与隔离 Color Lab 终选决策目录

职责: 保存可复核的 UI 语义基线、computed Token 快照与验收记录；历史截图不作为当前视觉事实，视觉判断必须重新读取当前运行界面；不得承载运行时代码或真实用户数据。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
