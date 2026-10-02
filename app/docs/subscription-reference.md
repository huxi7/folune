# 订阅界面：页面代码与业务语义

2026-09-30 从已登录内置浏览器 `https://laper.ai/app/new#upgrade` 读取 DOM、CSSStyleSheet.cssRules、计算样式与按钮内部结构；月付和年付均经过实际切换。截图仅辅助核对。

## 原始结构与 Folune 投影

| 元素 | 原页面代码参数 | Folune |
| --- | --- | --- |
| 主内容 | flex column；48px 24px padding；gap 24px | 保留 |
| 卡片网格 | 1248px / 四栏；gap 16px；margin-top 8px | 932px / 三栏，单卡仍 300px |
| 卡片 | min-height 540px；padding 24px 16px 16px；细边与两层柔影 | 保留，颜色消费 Folune token |
| 大标题/说明 | Courier New + 中文宋体；28px/37.333px、12px/17.143px | 保留层级与字体回退 |
| 套餐铭牌 | 品牌20px/500；名称28px/600；rotate(-.75deg)；玻璃底片 | 清晰42%/模糊58%互补mask，blur 2px |
| 权益行 | 13px、1.625行高、gap 10px，14px check，局部600强调 | 用 Folune 真实能力替换 |
| CTA | 32px；普通渐变 vs 高阶canvas流光 | Starter用Button，Pro/Studio用GlowButton；Starter按下只移除凹陷内影 |
| 年付 | 36x18 switch；年总价、月均、20%小标 | 后端总价 $48/$192/$960，月均 $4/$16/$80；折扣标记使用 DS 暖琥珀色，避免融入蓝色卡片 |
| 账户条 | 用户名/等级/每日积分/月积分/余额/购买入口 | 全部展示，未知值用破折号 |
| 关闭 | fixed top/right 24px，40px圆形外框，16px图标 | 保留，返回原工作区 |

原页面的第三方图标、品牌、shader程序未导入；图标和高阶流光消费既有 Folune 组件。浅暗色均使用 Folune 颜色。

## 产品口径

升级只展示 Starter/Pro/Studio，Free 保留于账户条。每日积分由服务端日 token 上限除以 10,000；余额为同日剩余额度除以 10,000，前端只格式化 API 返回的积分事实。每月额外积分当前为 0，没有充值钱包；积分每日 UTC 00:00 刷新，不跨日累积。对话长度、笔记引用和工具步骤都会影响消耗，因此不承诺虚构的固定对话次数。

卖点只列已实现的 AI 对话/写作、引用笔记、自动归档、批量整理、知识画布、可撤销操作和云端同步。积分购买路由 `/app/subscription/credits` 已承载六档预览弹窗，支付仍明确未接入。

## 积分购买弹窗

2026-10-01 读取已登录 Laper 真实 DOM 的几何：外壳宽 640px、圆角 24px；顶部 4:1 横幅高 159.5px；内容 padding 24px；标题 20px/400/26.7px，说明 12px/17.14px；余额框 110×52px、虚线边和 12px 圆角；三栏 grid 宽 590px、gap 12px，每卡 188.66×94.33px、24px 圆角；关闭按钮 40px、顶部/右侧各 16px。参考与Folune CTA均为40px胶囊，Folune保留现有Button的材质与交互，卡片选中只改变细边和外圈，不缩放。

Folune 展示 500/1,000/2,000/5,000/8,000/10,000 六档积分，$5/$10/$20/$50/$80/$100 由 API 唯一提供。标题、目录单选、状态和规则支持中英。弹窗标明预览/尚未开售；标签按用户要求改为“当前积分余额”，数值仍来自真实每日额度，规则说明其与未来购买钱包的区别。选包后只提交 `pack_id`，接口当前不创建订单、扣款或权益。积分图形复用 Folune SparkleIcon，横幅直接使用用户选定的第二次蓝色生成图，不叠加调色滤镜。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md


## 2026-10-01 账户与积分参考测量

本轮通过已登录 Laper DOM / getComputedStyle 读取（不是截图估算）：菜单宽256px、padding6px、外圆角12px；菜单行34px、padding8px、内圆角8px；身份头56px、头像40px、昵称12px/600、订阅按钮28px高。设置900×600，侧栏200px、正文24px内边距、导航8px圆角，参考外壳24px圆角、输入256×36及12px圆角。Folune设置初版采用外24/组20/内16；2026-10-02复测后已统一外壳、分组与内卡24px曲率，保留4px分组内缩。

积分弹窗参考640px宽、4:1横幅（159.5px）、正文24px内边距、三列12px间距、卡片188.66×94.33px及24px圆角；右上40px圆形关闭钮距边16px。六档预览积分包由API提供，不能创建付款事实，余额标签显示今日额度。购买入口现在打开模态层，按来路保留后面的工作区或订阅页；关闭回到来源，升级回到订阅。

实际英文font-family首项是Montserrat，已从Google Fonts自托管300–700拉丁可变字重并保存SIL许可，账户、订阅、积分与英文APP控件共用；中文保留原系统回退，品牌标题与笔记正文仍有自己的字体角色。菜单、设置、订阅/积分与高频工作区操作接入中文/English，不翻译用户笔记或AI生成内容。公开文章与法律正文仍为中文。

本轮用户明确自行进行视觉验收，因此停止浏览器检查；类型与交互测试不等于已获得视觉验收。


## 2026-10-02 设置与账户精确复测

本轮重新读取实际DOM及computed style，补测了之前遗漏的文字子节点与corner-shape。设置外壳、灰色分组、白色内卡均为24px + superellipse(2)，不能再用20/16替代；分组padding4、标题padding16 24、内容行padding24。栏目标题16px/600/22.4px，侧栏文字12px/400（选中600）/16.5px，字段/分组标题12px/500/17.1429px，说明12px/400/16.5px。按钮上传74×28、订阅48×28，字号12/500、padding-inline12；退出84×32、13px/500、左12右20（16px图标、8px间距）。

通用按参考分语言/外观两组，语言Select240×36（13px），主题无图标320×32（选项12px）。普通按钮白底、中性hover；账单订阅及用量升级保留品牌色。Folune日积分业务口径和自动保存不因视觉复刻变更。

底部账户卡外24px、内12px，padding12 12 8；菜单头56px、头像40、昵称12/600、订阅28px。菜单订阅实际由对角渐变、blur6px canvas和18%白色渐变+34%顶线叠加；独立AccountSubscribeButton复用已有ShaderGlow并隔离尺寸/玻璃参数，身份头整体hover，保留两个独立键盘可达动作。

代码与交互检查不等于视觉验收；用户自行查看本地结果。


## 2026-10-02 最终积分口径与主题滑块

最终1积分=10,000 Token；每日Free/Starter/Pro/Studio为10/200/1,000/5,000积分，对应10万/200万/1000万/5000万Token。订阅按月或年计费，积分每日刷新；不另限对话次数，不把daily×30称为月到账。六档未开售购买包500/1,000/2,000/5,000/8,000/10,000，美元5/10/20/50/80/100，固定100积分/$1。菜单、设置、订阅、购买弹窗共用整数无零尾/最多一位小数/<0.1显示规则；实际记账不舍入，API唯一换算。

Laper主题底片实际为320×32轨道内105×28白色滑块，24px与superellipse(2)，阴影为0 1px 3px black8% + 0 1px 2px black4%；已作用于Folune设置主题专属选择片，不影响其他分段控件。用量升级复用AccountSubscribeButton流光，移除简介下的常驻自动保存提示，自动保存行为保留。


## 2026-10-02 账户浮层边框与共享框线

直接读取用户已打开的 Codex 内置浏览器 Laper `/app/new` 账户浮层：`border-border/60`，基础边框 `#E4E8E6`，1px、60%透明度；计算样式显示 oklab 色值但原始基础色为该十六进制值。浮层宽256px、12px圆角、superellipse(2)、6px内边距；两层阴影为 `0 2px 4px 0 rgb(0 0 0 / 5%)` 与 `0 4px 6px -1px rgb(0 0 0 / 5%)`。

2026-10-02按用户确认的 Folune 微蓝方向，APP/Demo 的 `--border` 为 `rgb(228 230 232 / 60%)`（#E4E6E8），保持参考明度和透明度，纸边、输入、侧栏、设置与订阅/积分共用；输入悬停边界 #D4D6D8，主题轨道 #EFF0F1。`--shadow-sm` 使用菜单实测短柔影，账户浮层撤回私有叠加阴影。积分选中卡片与 Canvas 连接目标保留更明显的中性灰反馈。暗色边框使用10%白色，增强边界20%白色，短柔影使用20%黑色。

上述边框与浮层参数来自内置浏览器实测；Folune 本轮视觉验收仍由用户完成。


### 贴边阴影与主题底片修正

同一内置浏览器中设置外壳实测 `0 2px 4px black5% + 0 1px 2px -1px black5%`；白色内卡为 `0 1px 2px black6% + 0 0 1px black3%`，外部分组为 `inset 0 0 1.5px 0.5px black12%`。参考并非把同一层远投影套在所有容器上。Folune 设置与积分外壳消费前者（--shadow-xs），左右面板消费内卡贴边影（--shadow-2xs），菜单继续按菜单实测影（--shadow-sm）；色彩均为黑色灰阶。

主题底片曾被 APP 全局 `.ds-segmented-control-indicator` 的更高优先级选中底色覆盖。通用规则现在接受局部 --segmented-indicator-surface；设置主题提供 --popover 白亮底片，并保留8%/4%黑色凸起影；不改变其他分段控件的选中底色。


### 设置灰底的色相投影

用户打开的 Laper 设置个人资料页再次实测：外壳/白色内卡 #FCFDFC，灰色分组与200px左导航 #F4F6F5，均仅多1–2个绿色通道值；主题轨道此前实测 #EFF1F0。Folune按已确认的品牌方向保留 #FFFFFF 外壳、内卡与选中滑块；分组/导航灰底 #F4F5F6、主题轨道 #EFF0F1，仅把微绿转为同等程度的微蓝。普通 hover/secondary #EDEEEF、muted #F6F7F8、细微强调表面 #F7F8F9 同源；暗色继续使用既有黑灰映射。


## 2026-10-02 积分原始资源与二级菜单复测

内置浏览器实际积分横幅为1000×334 WebP，资源标识 `modal-header-haze/public`，经pageAssets原样导出为 `/account/credits-header-haze.webp`；实际4:1容器638×159.5，img按cover居中裁切。已删除此前猜测的CSS点阵/棋盘格覆盖。外壳640px、24px/superellipse(2)，卡片188.66×94.33、同样24px曲率，间距12px；数字Courier New 27.2px/700/27.2px，价格Montserrat 13px/600；余额框110×52、12px曲率、虚线30%灰；操作按钮40px高/胶囊超椭圆曲线。卡片下的conic渐变采用页面实际140deg起始/七色alpha/.4透明度/20px blur/inset8参数；选中外圈3px22%/14px18%保留其尺寸，以Folune品牌蓝的淡色边框/外圈替换绿色。价格、六档额度、未开售状态和规则依然由Folune事实驱动。

主题子菜单实测主菜单right264、子菜单left265，即1px距离；宽160、高122、内边距6、每行36。当前白天为浅灰字，跟随系统/黑暗为正常墨色，选中由主题事实决定。Folune保留鼠标缓冲、视口避让与键盘交互，并验证真实ThemeProvider下三项切换。语言国旗在20×20框内呈现，参考English对应美国；Folune中美国旗由公开旗帜几何独立绘制为同源SVG，不引入图标依赖。


## 2026-10-02 蓝色调色最终修正

用户最终明确选定第二次内置imagegen生成图（exec-abe66b5c-8e83-444a-b39f-fc2e8745b781.png），现以 `/account/credits-header-blue.png` 同源托管，实际2170×725。横幅直接呈现这张图片；此前原图+CSS调色方案已撤回，运行时不再应用 hue-rotate/saturate。卡片下方保留原有七色conic晕染，选中框线/外圈使用Folune品牌蓝。

选中档位：边框为70% primary与card混色，外圈3px/primary22%及14px/primary18%柔光；键盘焦点也使用primary。积分星号逐个消费1px/16%黑色近边影与2px/4px/primary35%蓝色柔影，不再通过整体opacity压淡。余额标签为“当前积分余额 / Current credit balance”，实际额度与付款边界不变。

用户选定的第二次内置imagegen提示词：

```text
Use case: precise-object-edit. COLOR CHANGE ONLY on the supplied original image. Preserve the original composition, every fine dot, woven grain pattern, texture density, mist shape, edge sharpness, brightness, and contrast. Keep the exact original aspect ratio and original 1000×334 dimensions. Do not upscale, enhance, sharpen, redraw, regenerate the pattern, add detail, enlarge the dots, rearrange texture, or change the empty near-white regions. Perform only a color grading/palette substitution: replace the existing faint olive/yellow-green/green haze with equally faint, low-saturation Folune steel-blue and blue-gray hues coordinated with #395875, #91ABC4, and #E4E6E8. Keep original luminance, gradients, transparency appearance and saturation strength; the new blue must be no stronger or darker than the original green. All spatial image content must stay fixed. No text, icons, frames, logos, additional shapes or new textures.
```


## 2026-10-02 二级菜单向上展开

按用户确认的方向，Folune语言/主题子菜单以最下面一行的中心对齐触发行中心，其余选项向上排列；浮层底边还包含末行下半部、内边距与边框，不能直接对到触发行中线；水平仍保持1px间距与左右避让，接近视口上边时保留8px安全距离。PresenceSurface使用top入场，变换原点位于靠主菜单的下角，使位置与展开方向一致。


## 2026-10-02 全局弹窗背景

直接读取用户已打开的Laper设置页：`.modal-wrapper`和底层页面均opacity1、无filter/backdrop-filter；独立 `.modal-backdrop.bg-background/85` 使用页面底色85%透明度，backdrop-filter为none，弹窗内容opacity1。看似模糊的效果来自背景对比度被降低，不是高斯模糊。

Folune共享Dialog的panel/bare统一 `background: color-mix(in srgb, var(--background) 85%, transparent)`，标准及WebKit backdrop-filter均为none。去掉此前12px黑遮罩与20px bare磨砂分支；浅色用当前白底淡化，暗色自动消费既有黑灰背景。设置、积分、确认弹窗、命令面板与Canvas预览沿同一Dialog策略，焦点/Escape/点击关闭/滚动锁定与root视图过渡不变。
