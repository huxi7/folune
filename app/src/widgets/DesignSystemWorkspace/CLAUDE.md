# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留目录
CLAUDE.md: 设计系统展示页的局部地图
index.tsx: Web DEV /design-system 入口；提供目录、搜索和主题切换
componentCatalog.ts: 登记现用组件名称与中英检索词
search.ts: 组件、材质与资产共用的多词检索
referenceSearch.test.ts: 锁定材质、品牌组合与多词检索
ComponentTile.tsx: 组合组件名称和交互样板
ComponentPreview.tsx: 分发实际组件；只拥有本地交互状态
FoundationSpecimens.tsx: 展示颜色、间距、尺寸与圆角读数
LiveTokenValue.tsx: 解析继承 token；颜色转换为十六进制，保留透明度
TypographyPreview.tsx: 展示字族、文字角色及实际字号、行高和字重
iconCatalog.ts: 登记现用 Lucide 语义图标
iconCatalog.test.tsx: 锁定六类图标语义及字形区分
MotionSpecimen.tsx: 展示动效配方及菜单、侧栏和模态交互
PanelMotionSpecimen.tsx: 展示助手顶栏、历史与输入浮现；切换保留草稿
AssetLibrary.tsx: 预览现用资产；原图与许可提供紧凑下载入口
assetCatalog.ts: 登记品牌、媒体、截图、字体和下载项
assetCatalog.test.ts: 验证文件、实际消费路径与目录唯一性
MaterialSpecimens.tsx: 挂载 Hero、登录散墨、点阵、纸纹与导轨
ProductSpecimens.tsx: 展示 Canvas 与助手；交互只改变本地状态

职责边界：共享设计原语定义外观与效果。
产品组件与本页使用同一套参数。
本目录只定义陈列几何与样板状态。
页面以名称、实物和必要参数表达规范。
页面不显示源码路径或来源说明。
未挂载组件、历史参考和假想状态不得入册。
关系线在真实 Canvas 样板中展示。
归档线保持独立可交互样板。
颜色与几何读取当前 APP 主题的计算值。
营销背景保留自己的品牌色轴。
减少动态沿用系统媒体查询。
独立路由和样板 CSS 仅在 Web DEV 懒加载。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
