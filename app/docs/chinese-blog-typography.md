# Folune 中文博客排版研究与应用

> 决策日期：2026-09-25。适用 `/blog`、`/updates` 及共享阅读模板的 `/terms`、`/privacy`。这是代码层排版方案，实际屏幕阅读与视觉验收由用户完成。

## 结论

采用「衬线标题 + 比例黑体正文」的单栏网页阅读方案。保留 Folune 既有字体体系、纸色、墨色与导轨，不下载中文字体。用户实际查看后否决了 18px/17px 的放大方案，认为过于粗犷；现恢复桌面 16px、移动端 15px，保留自然字距、1.85 行高、约 36 个全角汉字的文字栏和已认可的导读侧线。使用原生中西文间距和渐进增强的标点处理，不变更原始文案，不添加 DOM 排版脚本。

这些数值是结合产品约束作出的设计选择，不是某项研究证明的唯一最优值。字体与排版偏好存在个人差异，设备、视距、任务和文本语言也会影响研究结果。

## 检索范围与证据质量

Exa 分别检索排版规范、中文阅读实验、中文排版实践三个方向，并追加 WCAG 专项检索，共请求 29 条候选结果。Tavily 另检索 CSS 原生能力和中文屏幕阅读实验，共 12 条候选结果；其中存在重复、旧规范版本、手机研究与非中文研究，不能当作 41 个独立证据。对关键来源继续读取原文或摘要，并直接查询 MDN browser-compat-data。Tavily 综合研究端点返回 504，因此本文结论来自上述检索与核实，没有把未返回的报告作为证据。

| 来源 | 核实的内容 | 如何使用及限制 |
| --- | --- | --- |
| [W3C《中文排版需求》CLREQ](https://www.w3.org/TR/clreq/) | 汉字密排、中西文间距、标点禁则、行内调整 | 中文排版专业参考；并非某一套屏幕字号的实验证明。通常保持汉字外框紧贴，中西文留白与普遍字距是两件事 |
| [W3C Chinese Script Resources](https://www.w3.org/TR/hani-lreq/) | 中文文字系统的断行、间距及实现议题 | 中文不依赖词间空格识别正常词界，不能套用英文全文加空格策略 |
| [W3C WCAG 2.2 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation) | AAA 指标中的 CJK 40 字上限、非两端对齐、缩放与行段间距机制 | 用作行长和可访问性的保守参考；36 字栏不代表整站达到 AAA |
| [W3C WCAG 1.4.12](https://www.w3.org/WAI/WCAG21/Understanding/text-spacing) | 用户覆盖行距/段距/字距后不能丢失内容或功能 | 0.12em 字距等是覆盖测试条件，不要求网站默认这样排中文 |
| [Chan 等：中文屏幕校对实验](https://pubmed.ncbi.nlm.nih.gov/24930173/) | 行长、行数和行距存在交互；校对任务建议 36 字、4 行和 1.5 行距 | 支持适中行长和联合调整；校对任务的最优配置不能直接等同于长博客阅读 |
| [Wang 等，2024：中文多行阅读眼动](https://doi.org/10.1186/s41235-024-00559-5) | 单/双栏、左齐/两端对齐影响回行眼跳，整体阅读时间和理解效率影响有限 | 两端对齐有更有效的回行眼跳表现，不能声称左齐在所有中文场景更快；本项目选左齐是混排、响应式与无障碍取舍 |
| [Zhu 等：简体中文手机字号与行距](https://doi.org/10.1093/iwc/iwab020) | 115 人、5.9 英寸手机、三档字号与三档行距；字号和行距影响阅读时间及主观疲劳 | 支持字号与行距共同考虑；手机、point 单位和特定设备不用于推导桌面 18 CSS px 是最优值 |
| [香港中文句段阅读语料研究](https://www.nature.com/articles/s41597-023-02813-9) | 段落采用每行 38 字、16pt 宋体、双倍行距的先导配置 | 这是一套采集配置，不是与其他字体全面比较后证明宋体优胜 |
| [中文词间空格眼动元分析](https://journal.psych.ac.cn/adps/EN/10.3724/SP.J.1042.2015.01894) | 18 篇文献、756 人，不同熟练度和读者群体的收益不同 | 词间空格不是中西文间距；不能据此把母语中文整篇拆成空格词组 |
| [MDN text-autospace](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-autospace) | `normal` 补中西文/数字间距，默认 insert 行为保留已有空格 | 明确写 `normal`；不依赖浏览器初始值，不使用兼容不齐的组合值 |
| [MDN text-spacing-trim](https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim) | 连续全角标点空隙压缩、行首标点处理、字体特性条件 | 只在支持 `trim-start` 时启用；不强制所有标点半宽 |
| [MDN line-break](https://developer.mozilla.org/en-US/docs/Web/CSS/line-break) | CJK 标点断行规则，`strict` 比 `anywhere` 更严格 | 设 `line-break: strict` 与 `word-break: normal`，长链接仍允许紧急换行 |
| [赫蹏](https://sivan.github.io/heti/) / [源码](https://github.com/sivan/heti) | 局部正文增强、亲密性段距、中西文间距、标点挤压 | 借鉴范围隔离与节奏；它的字体方案、引号选择和 JS 增强不整体搬入项目 |
| [Typo.css](https://github.com/sofish/typo.css/) | 中文网页排版与局部阅读样式 | 参考其中文增强方向，不引入第二套全局 reset |
| [pangu.js](https://github.com/vinta/pangu.js) | 向汉字与半角英数之间插入空白、可遍历并修改 DOM | “盘古之白”是常用社区称呼；README 的婚恋统计是幽默文案，不是学术证据。当前浏览器原生能力足够，不需要运行时遍历 React DOM |

## 初次调研时的代码观察

1. `global-base.css` 的 body 使用 `--tracking-normal: -0.012em`，原博客正文没有覆盖，汉字也被压紧。恢复 natural tracking 比直接给所有汉字加 0.05em 更符合正常密排。
2. `--landing-body` 原为 iA Writer Quattro S 加中文黑体回退。中文和英文并不是同一个字体，较宽的拉丁字形在 AI、Markdown、Supabase 等术语较多的文章中形成明显节奏差异。其可读性影响尚未进行用户测试，但选择同一比例字体体系更稳妥。
3. 正文字号为桌面 16px、移动 15px；导读 14px。正文行高已达 2 倍，因此问题不能简单归为“行距太小”。首次尝试放大到 18px 被用户否决，现恢复原字号，相对行高保留 1.85，桌面行高为 29.6px。
4. 原正文 672px 外宽包含两边 48px padding，实际文字宽度是 576px，约 36 字；原来并非过长。首次尝试的 612px、34 字栏随放大字号被收回，现恢复 576px、36 字。
5. 导读有完整边框、圆角和底色，看起来更像一个独立控件。改为细侧线加正文排版，减少阅读中的视觉分块。

## 候选方案与最终选择

| 方案 | 优点 | 不采用的原因 / 选择依据 |
| --- | --- | --- |
| 全文宋体、两端对齐、首行缩进两格 | 接近传统纸本、边缘整齐 | 系统宋体的屏幕表现跨平台差异大；中英混排拉伸和链接换行不易控制；不是此次屏幕阅读的默认方案 |
| 整体引入赫蹏或 Typo.css，再用 pangu/heti JS 补间距 | 能较快获得完整的中文排版规则 | 项目已有完整设计系统和 React 内容模板，会引入重复样式及 DOM 修改边界；用户并不需要竖排、诗词等全部能力 |
| 既有衬线标题 + 比例黑体正文 + 原生 CJK CSS | 保留品牌、跨平台回退清晰、无新增字体或 JS 依赖、原文不变 | **采用**。将排版约束限定在 `.blog-spine`，数值由局部少量变量管理 |

## 当前规格（依用户验收反馈收回字号放大）

| 项目 | 原实现 | 本次实现 |
| --- | --- | --- |
| 正文字体 | Landing Writer + 中文 sans 回退 | 既有 `--font-sans`；常见 macOS 下拉丁 Avenir Next、中文 PingFang SC；其他系统按已有栈回退 |
| 标题字体 | Landing Serif + 中文 serif 回退 | 保留；中文通常为 Songti SC 等可用系统衬线字体 |
| 桌面正文 | 16px / 2 | 1rem / 1.85，默认根字号下 16px / 29.6px |
| 手机正文 | 15px / 2 | --type-body / 1.85，默认根字号下 15px / 27.75px |
| 文字栏 | 576px，约 36 字 | `--blog-body-size × 36`，桌面 576px；外侧 padding 单独计算，窄屏自然缩小 |
| 字距 | 继承 -0.012em | `normal`，不普遍加空格或正 tracking |
| 段落 | 20px 段间距 | 1.1em，约 17.6px；左齐，不叠加首行缩进 |
| 章节标题 | 上方 40px / 下方 20px | 上方 2.75 正文 em / 下方 .75 标题 em，标题与下文归组更清楚 |
| 导读 | 完整框、圆角、底色，14px | 细中性侧线、--type-input（14px）/ 1.85；作为阅读引言 |
| 目录摘要 | 14px、不限制自身行长 | --type-input（14px）/ 1.85、最多 36em |
| 图注 | 12px | --type-label，默认 12px |
| 末端推荐 | 固定 576px | 共用正文文字栏和侧边距，对齐阅读轴 |
| 中西文间距 | 依赖手写空格和浏览器默认值 | `text-autospace: normal`，保留原文和现有空格 |
| 标点 | 浏览器默认 | 中文语言继承 + strict 断行；支持时 `text-spacing-trim: trim-start` |

阅读栏采用 rem 派生的宽度，而不是 `36ch`：`ch` 通常是拉丁数字 0 的宽度，不能拿来代表 36 个汉字。这里约 36 字以全角方块字宽近似；实际一行数量会受英文、标点压缩、平台字体和缩放影响。

## 兼容性与内容完整性

- 查阅日期的 [MDN BCD text-autospace](https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-autospace.json)：`normal` 支持 Chrome 140、Firefox 145、Safari 18.4 起；这些浏览器的初始值仍可能是 `no-autospace`，因此显式声明。Chrome 尚未支持全部细分值，采用 `normal` 最稳妥。
- [BCD text-spacing-trim](https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-spacing-trim.json)：`trim-start` 当前主要在 Chromium 123+ 可用，Firefox/Safari 不齐；使用 `@supports`，不支持时保持正常全角标点。效果还取决于字体的 halt/chws 特性，不手工负 margin 模拟。
- [BCD text-wrap-style](https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-wrap-style.json)：`pretty` 仍非完全互通。正文不依赖它保证行尾效果；短标题保留渐进增强的 balance。
- `text-autospace: normal` 不会把原有 U+0020 再叠一个间距，但也不会把既有空格统一替换成同一宽度。此次不做文本清洗，避免改动复制结果、搜索匹配或正文版本。
- 正常中文使用 `line-break: strict; word-break: normal`。`overflow-wrap: anywhere` 仅在长链接等无可用断点的内容溢出时提供紧急换行，不使用会普遍拆词的 `word-break: break-all`。
- code/pre/kbd/samp 显式退出自动间距与标点挤压，避免代码文本的视觉结构被排版规则改变。
- 保留完整段落和标题，不逐字包装、不加 MutationObserver、不更改内容源、不禁用用户缩放。没有固定正文高度或行数截断。最终 200% 缩放与用户覆盖间距的实际效果仍需浏览器验收。

## 实现与验证边界

运行时只调整 `app/src/styles/blog.css`；`.blog-spine` 中局部覆盖正文族，首页、共享顶栏、Footer、登录及 APP 字体不随之变化。博客目录、动态、正文、服务条款与隐私政策共用此边界。既有花纹、空轨、节点和局部外框入场不变。

初次方案的工程验证结果（不代表用户接受视觉）：类型检查与生产构建通过；公开阅读/导航和 APP 排版边界共 13 项测试通过。生成的 CSS 保留了桌面/手机字号、阅读栏变量、原生中西文间距与标点规则。`git diff --check` 通过；Lint 仅有原有 Hero 实验页控件缺少标签的警告，构建仍提示既有 Mastra 依赖的 Node module 浏览器兼容警告。

按照用户要求不进行浏览器或视觉验收，因此不声称已经验证字体实际命中、像素效果或阅读速度提升。此次未部署，实际阅读感受由用户在现有本地页面验收。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
