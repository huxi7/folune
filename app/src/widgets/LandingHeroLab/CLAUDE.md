# LandingHeroLab/
> L2 | 父级: ../CLAUDE.md

独立开发页 `/hero-lab.html`。当前主候选仅为 01A/02A，01B/02B 已被用户否决并退出主选择；03、04 退出可见选择，但旧配置仍可恢复。原来的 A/B/D 留作早期参照。本模块仍不改共享组件接口、认证与构建；选定 02A 已在独立生产组件中接入正式 Hero，Header/文案/按钮/三栏按生产投影，APP 衔接可选装配 LandingEditor。

成员清单
HeroLab.tsx: 全宽预览与 01A/02A 浮动切换条、面板/加载/暂停状态，不挤占产品布局
FirstScreen.tsx: 生产首屏投影，Header 同步使用场景入口；量取周围区块控制高度，可选既有 APP 展示
Controls.tsx: 按算法能力显示材质参数和 B 版边缘柔和度，收藏预览时显示所见参数并锁定编辑
SavedStudies.tsx: 多组命名收藏列表、对照/载入副本、重命名/删除撤销与整份 JSON 备份 UI
useSavedStudies.ts: 一条收藏一个 localStorage 键，监听同源跨标签变更；迁移旧单对照，导入先验证后以新 ID 合并，不覆盖其他收藏
presets.ts: 候选元信息与默认值、参数范围、v1→v2 Snapshot 校验；保留 ink/paper ID 兼容旧草稿，新增 ink-b/paper-b
useLabState.ts: 逐方案草稿、共享高度、暂停和收藏预览；v1 只读迁移到 v2，预览不覆盖草稿，载入/继续播放使用副本
HeroArtwork.tsx: Paper 与 A/B shader 装配，量取实际文案/按钮矩形传给 B 版减墨；单候选 140 万像素、上下文丢失反馈和连续时钟
inkShader.ts: 01A 增强版和已排除 04 的原算法，仅提取公共函数，保持此前时间/颗粒形态
inkBShader.ts: 已否决 01B 历史算法，左上主墨面与右下浅呼应，连续场只改变墨岸边缘及内部着墨，真实阅读区在密度内减淡
grainMaterial.ts: 01A/01B 共用连续噪声与邻格颗粒采样，不拥有构图与时间策略
paperBShader.ts: 已否决 02B 历史算法，对安装版 Paper GrainGradient 源串做有锚点的有限改造，保留纸粒/调色链路，替换 wave 场形为两层不同速度的斜向墨面，增加实际阅读区衰减与可调粒径；适配器与 0.0.80 绑定
useAmbientMotion.ts: 系统减少动态、用户暂停、后台/离屏共同决定 speed，逐帧更新不经 React state
hero-lab.css: 仅 Lab 的高度、侧轨后景、操作条/面板/收藏样式；A 版保留旧遮罩，B 版阅读留白归 shader，不加中央椭圆
main.tsx: 独立 React/DS 入口，固定浅色，不挂 Router/Auth/业务 Store
REVIEW.md: 当前 A/B 方案默认值、算法决策、数据保存与未运行验收边界；旧四版和六版结论按历史归档
THIRD_PARTY.md: Paper 改造及历史 React Bits/Aceternity 的来源与许可证
PAPER-LICENSE.txt: Paper Shaders Apache-2.0 完整许可证，随局部改造源码保留
LibraryArtwork.tsx: 已淘汰 E/F 历史装配，当前入口不加载
ReactBitsWaves.tsx: 已淘汰 E 官方 Canvas/Perlin 历史适配，保留许可追溯
AceternityBeams.tsx: 已淘汰 F 官方 Motion 路径历史适配，保留许可追溯

默认：新用户进入 02A，60svh；已否决 B 版参数仅保留用于旧收藏复现：01B 浓淡 .68/粒径 1.65/尺度 1.08/速度 .34/留白 .8/柔和 .58。02B 浓淡 .72/粒径 1.2/尺度 1/速度 .46/留白 .82/柔和 .62/纸粒 .16。02A 无存量草稿时使用用户 12:23 截图参数：78%/.96/.68/80%/纹理14%/偏移-.26,.18/-17°；旧草稿优先，绝不以新默认覆盖用户调整。

保存契约：草稿 `folune-hero-grain-lab-v2`，旧 `folune-hero-grain-lab-v1` 不写不删；收藏 `folune-hero-grain-gallery-v1:item:<uuid>`。每份快照保存算法身份/参数/高度/时间。收藏读取只限本模块前缀；同源其他窗口的收藏事件只刷新列表。载入配置与收藏导入都做范围校验。刷新会保留收藏，换浏览器需导出/导入备份。删除的最后一项可在当前面板会话撤销。

A/B 不是只改速度与颜色：01B 增加宏观主次和受控轮廓，02B 替换底层波面组织并开放柔和度/纸粒浓度。01A 算法不改，02A 官方 wave 不改，公共采样提取不改变 01A 最终 GLSL 内容。B 版的中央留白直接减少着墨，文字/字号/位置始终不动。只有一个 Hero canvas，APP 另有自身背景实例。

执行边界：2026-09-19 代码已写入，按用户原要求未运行测试、构建或浏览器验收；默认值是完成的代码预设，未声称实看确认优于 A 版。上轮提交 fefdc2b 为完整回退点。当前没有把任何候选写回正式 Hero。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-19 用户否决 B 版：两版都是左上浓/右下淡的大色块，缺少颗粒质感与自然变化。主选择撤下 01B/02B，启动时旧 B 链接/选中态映射到同组 A；B 草稿及所有收藏不删除，旧收藏仍可显式预览。恢复以 01A/02A 为主的比较，不再把固定大色块当成优化方向。未改正式 Landing 或运行测试。

2026-09-19 最终接入：用户选定 02A 并授权修改正式页。生产 LandingMotion/HeroBackdrop.tsx 固定参数为 wave、scale .96、speed .68、offset -.26/.18、rotation -17、intensity .07、noise .19、softness .8；landing.css 固定 60svh/浓淡78%/中央留白65%。正式页没有反向导入 Lab，实验草稿与收藏继续独立。上文未接入描述属于当时执行边界；本次正式接入未运行测试或浏览器验收。
