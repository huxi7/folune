# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
LoginBackdrop.tsx: 登录正文的 01A 散墨背景，沿用终选材质参数，speed .04（原 .28）、初始帧 12000；量取宿主 CSS 尺寸，140 万像素上限，减少动态停帧，无 WebGL2 保留纸面，浓淡与边缘遮罩归 auth.css
inkShader.ts: 从 Lab 提取的原 01A/历史 04 散墨算法，正式登录和 Lab 共用；只消费 uniforms，不反向读取实验参数或收藏
grainMaterial.ts: 散墨候选共用连续场与邻格颗粒 GLSL，构图和速度归调用方
MarketingLink.tsx: 标准 Router 链接边界；保留历史、state、新标签和锚点，内容入场由营销壳拥有，不启动整页截图过渡
useMarketingMotion.ts: 按显式分组编排首屏同拍、文章行错峰与首次滚动浮现；父组排除嵌套标记，query/清除已消费锚点不重播，焦点立即显示整组
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级
HeroBackdrop.tsx: 用户选定 02A 的正式 Hero 颗粒波面，按需加载 GrainGradient wave；尺度 .96、速度 .68、偏移 -.26/.18、方向 -17°、intensity .07、noise .19，140 万像素上限，减少动态时以 speed=0 保留静帧；78% 浓淡和 65% 阅读遮罩由 landing.css 承载，不读取 Lab 收藏
ShowcaseBackdrop.tsx: APP 展示区与功能细节图片共用的细点阵背景；铺满各自宿主矩形，以品牌墨蓝、低透明度和慢速 warp 构成流动；Paper Shaders 按实例接近视口时加载，每处限制 90 万渲染像素，离屏/后台由库停帧，减少动态效果或无 WebGL2 时使用静态 CSS 点阵

职责: MarketingLink 保留 Router 导航语义。useMarketingMotion 独占营销入场。时长、曲线、错峰与视口边距共读 DS marketingMotion，CSS 只消费配方。HeroBackdrop、ShowcaseBackdrop 和 LoginBackdrop 各自拥有后景。背景不截获交互。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
