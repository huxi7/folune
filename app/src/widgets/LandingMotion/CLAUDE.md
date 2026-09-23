# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
LoginBackdrop.tsx: 登录正文的 01A 散墨背景，沿用终选材质参数，speed .04（原 .28）、初始帧 12000；量取宿主 CSS 尺寸，140 万像素上限，减少动态停帧，无 WebGL2 保留纸面，浓淡与边缘遮罩归 auth.css
inkShader.ts: 从 Lab 提取的原 01A/历史 04 散墨算法，正式登录和 Lab 共用；只消费 uniforms，不反向读取实验参数或收藏
grainMaterial.ts: 散墨候选共用连续场与邻格颗粒 GLSL，构图和速度归调用方
MarketingLink.tsx: 公开导航的 Router Link 适配，路径/锚点变化才启用原生过渡；新标签、历史/state 和减少动态效果沿原语义
useMarketingMotion.ts: MarketingLayout 的正文编排，路由/锚点在滚动恢复后只命名当前视口内的显式 reveal 内容；原生快照与 CSS 入场互斥，滚动只揭示一次，query/清除已消费锚点不重播，焦点立即显示内容
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级
HeroBackdrop.tsx: 用户选定 02A 的正式 Hero 颗粒波面，按需加载 GrainGradient wave；尺度 .96、速度 .68、偏移 -.26/.18、方向 -17°、intensity .07、noise .19，140 万像素上限，减少动态时以 speed=0 保留静帧；78% 浓淡和 65% 阅读遮罩由 landing.css 承载，不读取 Lab 收藏
ShowcaseBackdrop.tsx: APP 展示区与功能细节图片共用的细点阵背景；铺满各自宿主矩形，以品牌墨蓝、低透明度和慢速 warp 构成流动；Paper Shaders 按实例接近视口时加载，每处限制 90 万渲染像素，离屏/后台由库停帧，减少动态效果或无 WebGL2 时使用静态 CSS 点阵

职责: Landing 克制反馈层；MarketingLink/useMarketingMotion 连接 Router 导航与营销正文浮现，时长/曲线/错峰共读 DS motion.ts，形制归 marketing-motion.css。HeroBackdrop 承载已定稿首屏，ShowcaseBackdrop 为两个产品展示面提供一致后景，CountUp 呈现数据变化；背景不截获交互，正式 Hero 不导入实验页或其持久化状态。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
