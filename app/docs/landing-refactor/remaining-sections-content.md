# 剩余区块执行记录：关联展示与日常场景

> 日期：2026-09-19。执行 [remaining-sections-plan.md](remaining-sections-plan.md)。本文记录实际文案、素材来源、运行证据与验收边界；计划文件本身不再改动。

## 1. 结果

| 原区块 | 结果 |
| --- | --- |
| 社区数据「开放协作的力量」 | 整段删除，含头像条、四个数字与私有派生数据；`.landing-open-source` / `.landing-avatar-strip` / `.landing-stats` 样式一并删除 |
| AI 协作「顺着你的思路，与 AI 协作」 | 替换为 `LandingConnections.tsx`「让旧笔记，接上新思路。」，沿用 `#workflow` |
| 扩展生态「更多扩展，更多可能」 | 替换为 `LandingUseCases.tsx`「把零散记录，用在具体的事情上。」，锚点 `#use-cases`，移到功能细节之后；`#extensions` 保留为无内容定位别名 |

页面顺序：功能网格 → 笔记关联展示 → 功能细节 → 日常使用场景 → 创作者信。评价区 `#community` 未动。顶栏「扩展参考」改为「使用场景」；参考文档、参考定价与 Delta 三个外链仍保留，属于后续导航整理。

## 2. 关联展示的真实运行链路

环境：本地 Vite `http://localhost:10000/app`，API 10001 与 Chat 10002 为既有运行服务，正式账号中的「写作研究」演示笔记（features-content.md 建立的同一批材料）。浏览器为 Ego Lite。

操作顺序与实际结果：

1. 打开「卡片笔记法」的默认 Canvas，画布上只有这一张来源卡片（select.png 在此刻截取，卡片底部可见「AI 拓展这条分支」入口）。
2. 点击「AI 拓展这条分支」。正式流程返回 4 篇相关笔记：「读书摘记：用自己的话重写并连接到写作」「散步时的灵感」「让记录成为思考的起点」「先记录，再分类」，每条关系都带 AI 理由入口。
3. 点击「适配视图」后放大到「卡片笔记法 ↔ 读书摘记」这一条关系，取消卡片选中，截取 discover.png。
4. 点击该关系中点的「查看 AI 关联理由」，浮层展开后截取 reason.png。理由原文：

   > 它把"用自己的话写下理解"落实为读书摘记的具体做法，并同样主张从记录之间的联系开始写作。

5. 刷新画布确认 5 张卡片与关系均已持久化；重开后在同一关系上再次展开理由，截取窄幅 reason-mobile.png。

页面上的两段引文分别来自两篇笔记的正文，采集时已在 DOM 中逐字核对：

- 卡片笔记法：「用自己的话写下理解，比复制整段原文更容易发现联系。」
- 读书摘记：「读书时打动自己的句子，要用自己的话再写一遍。」

### 必须如实呈现的两点

- AI 拓展刚完成时，目标卡片显示的是 AI 选中的相关摘录；刷新后卡片恢复为笔记摘要，理由仍保留。discover.png / reason.png 是拓展当时的画面，reason-mobile.png 是重开后的画面，二者摘录文字不同属正常。页面文案只说「找到相关摘录」，不说「定位到原文段落」。
- 这是一次真实结果的一条关系。其他三条关系留在取景之外，页面标注「操作示例 · 画面来自一次真实 AI 拓展」，不暗示每次都返回相同数量。

## 3. 素材文件

| 文件 | 来源 | 尺寸 |
| --- | --- | --- |
| public/landing-connections/select.png | 1440×900 视口整页截图，拓展前 | 1440×900 |
| public/landing-connections/discover.png | 同一视口 CSS 裁切 (480, 248, 720, 450) @2× | 2880×1800 |
| public/landing-connections/reason.png | 同一裁切区，理由浮层展开 | 2880×1800 |
| public/landing-connections/reason-mobile.png | 重开画布后裁切 (662, 340, 322, 210) @2× | 644×420 |

三态共用 8:5 舞台，`object-fit: contain`；手机 (≤767px) 的「查看理由」态经 `<picture>` 换用 reason-mobile.png，并在图下用 HTML 补两段原句与完整理由。

## 4. 日常场景文案

三组小样即计划第 6 节的原创示例，页面标注「内容示例」，不含账号、机构、数字或日期：

| 场景 | 材料 | 产出 |
| --- | --- | --- |
| 灵感记录 · 留下那句来不及展开的话 | 随手记：散步时想到：有些话，写下来之后才知道自己想说什么。 | 接着写：我常常不是想清楚了才写。先留下一句，才慢慢看见问题。 |
| 学习摘记 · 让读过的内容变成自己的理解 | 摘记与疑问：读完后，试着合上书，用自己的话复述。／记住原句，和真正理解有什么区别？ | 我的理解：原句是线索。能解释、举例，再联系自己的经历，才是我真正带走的部分。 |
| 项目思考 · 把散落的想法变成下一步 | 两条观察：入口里同时出现很多选项。／我每次都只想先记一句话。 | 下一步：先让记录入口更直接，再观察分类是否还会打断书写。 |

## 5. 验收

- 1440px 与 390px 实际浏览：connections-desktop.png、use-cases-desktop.png、connections-mobile.png、use-cases-mobile.png。390px 文档宽度 390，无横向溢出；手机原句与理由 14px。
- 三态切换：桌面与 390px 下 Home/End/方向键循环五次，`#workflow` 高度（桌面 913px、手机 864px）、scrollY 与下方 `#feature-details` 顶边均不变；焦点跟随选中项且 `:focus-visible` 为真。切换只改本地状态，不发请求。
- 锚点：`/#workflow`、`/#use-cases`、`/#extensions`、`/#community` 定位后目标顶边均为 64px；`#extensions` 与 `#use-cases` 落在同一位置；从 /blog 点击「使用场景」返回首页并定位到 `#use-cases`。`main` 内分区顺序为 community → features → workflow → feature-details → use-cases → resources → blog。
- 旧类名 `.landing-open-source` / `.landing-split` / `.landing-extensions` / `.landing-stats` 在页面与源码中均无残留。
- reduced-motion 时淡换过渡关闭，内容完整。
- `bun run typecheck`、`bun run lint`、`bun run build`、`git diff --check` 全部通过；lint 仅余并行 Hero Lab 目录的一条既有警告，不属本轮。

## 6. 未处理与边界

- 评价区机构与引语仍是版式占位。
- 顶栏参考文档、参考定价、Delta 与 Footer 预留入口未处理。
- Hero Lab 未接入正式首页。
- 未修改业务 API、数据库、AI 提示词、正式 Canvas / Paper 行为与互动 Demo。
- 演示数据在正式账号中多了 4 条 AI 关系与 4 张卡片，均由正式流程写入，未手工插入或删除。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
