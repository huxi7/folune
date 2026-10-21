# 文档索引

跨模块文档集中在此。模块专属文档与源码就近存放。
各级 `CLAUDE.md` 留在原目录，作为源码地图。

## 产品约束

- [Canvas 产品宪法](product/CANVAS_CONSTITUTION.md)：知识画布的产品身份、交互边界与验收问题。
- [Paper 产品宪法](product/PAPER_CONSTITUTION.md)：写作舞台、纸面、浮层与归档线的产品约束。

产品宪法记录产品决策，只在决策改变时更新。
源码地图记录当前实现，随代码更新。

## 模块文档

| 内容 | 入口 |
| --- | --- |
| 全局架构与模块导航 | [项目地图](../CLAUDE.md) |
| 品牌与视觉规格 | [品牌规格](../app/brand-spec.md) |
| 共享动效规则 | [动效系统](../app/MOTION_SYSTEM.md) |
| 用户端研究与验收 | [用户端文档地图](../app/docs/CLAUDE.md) |
| 认证配置 | [认证指南](../app/AUTH_SETUP.md) |
| 订阅与支付接口 | [计费边界](../api/BILLING.md) |
| 支付实现与发布记录 | [NOWPayments](../api/NOWPAYMENTS.md) |
| 本地开发与部署 | [部署指南](../deploy/README.md) |
| OAuth 契约 | [OAuth 指南](../deploy/OAUTH.md) |
| 桌面开发与发布 | [桌面指南](../desktop/README.md) |

验收记录只证明记录时的结果。当前行为须核对代码与运行环境。

## 历史归档

- [Canvas V2 阶段清单](archive/CANVAS_V2_PHASE2_BACKLOG.md)：保留当时取舍，不作为当前需求入口。

## 文档与 Git

产品约束、设计规格、开发指南和有价值的历史决策由 Git 保存。
`archive/` 表示历史状态，归档文件仍随仓库公开。

个人草稿与本机记录放在 `docs/local/`，该目录已被 Git 忽略。
需要时自行创建；它不承载团队文档，也不作为凭据存储。
私有运维记录和真实用户数据存放在仓库外。

`.gitignore` 不会取消已跟踪文件，也不会清除历史提交。
第三方素材的许可证与署名保留在素材原目录。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
