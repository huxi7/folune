# app/src/shared/locale/
> L2 | 父级: ../CLAUDE.md

成员清单
credits.ts: 积分统一显示策略，整数无零尾、小数向下保留一位、微量显示<0.1，绝不参与Token换算或扣费
credits.test.ts: 整数、小数、浮点边界、微量和非法值显示回归
documentLocale.ts: 共享文档语言纯策略，公开中文页保持 zh-CN，返回工作区恢复已选语言；Provider 与既有已提交路由边界共用，不添加第二套监听
index.tsx: 不依赖持久化的唯一语言 Context 与消费入口；useLocale 提供成对文案及 Intl 日期/数字格式，独立 Demo 只读中文默认值
LocaleProvider.tsx: 正式入口装配的语言状态与浏览器持久化边界，恢复偏好、同步跨窗口 storage 事件及文档语言；展示组件不导入此模块
locale.test.tsx: 两项语言下拉/设置主题切换、资料草稿与用户内容保真、账户日期格式、公开页面语言往返、持久化恢复、跨窗口同步、存储异常与无 Provider 零副作用门禁

职责: 只翻译产品界面，不改写用户笔记、模型内容或服务器事实；消费方在各自职责旁声明中英成对文案，设计系统仍通过 props 接收显示内容。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
