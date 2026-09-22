# 独立登录页与书房花园视频

2026-09-22。用户要求参照 https://laper.ai/login/ 的左侧登录/右侧视频布局，保留现有 Landing Header，使用提供的本地视频循环播放。

## 当前实现

- `/login` 是 MarketingLayout 内的公开页面。Header 的品牌、导航、打开/下载动作及首页公告继续共用；登录页不装配营销 Footer。
- 原 AuthDialog 改为 AuthForm。邮箱登录、双密码注册、六格 OTP、Google OAuth 仍经既有认证服务；成功导航到 `/app`，由后端 Profile loader 继续判定准入。
- 顶栏、Hero/末端 CTA、Footer 和 OAuth 失败返回统一进入 `/login`。旧 `auth=login` 查询兼容重定向，因此独立 Hero Lab 的旧入口仍有效。
- 参考站点在 1440×1000 下左栏 384px、间距 96px、右框 573×840px；其原视频为 1440×2560，框内使用 cover，实际显示比例随视口高度改变。
- 本页保留 384px/96px/573px 的宽屏构图。用户视频确为 720×960、24fps；完整保持 3:4，右框 573×764px。矮屏按高度等比缩小，1280×720 时为 397.5×530px，表单和视频完整落在首屏。
- 本地视频保留 H.264 原码流，移除音轨并前置 MP4 索引；原 Downloads 文件不变。浏览器静音自动循环、内联播放；用户明确要求纯背景，因此不显示原生或自建播放控件，也不维护暂停状态。手机沿用参考页的单列表单。
- 入口先加载 index.css 确立全局 CSS 层序，避免局部 components 样式先到时，后到的 Tailwind base 重置 Header 和表单。

## 首版验证（早于细节精修）

- 内置浏览器目视：1440×1000、1280×720、390×844；320×740 注册模式无横向溢出，高度不足自然滚动。
- 浏览器操作：首页主按钮进入登录页、返回首页保留 Header/Footer、旧 `/blog?auth=login` 到 `/login`、注册切换、暂停/手动播放、减少动态偏好暂停和静态首帧。
- 自然播放观察到 currentTime 从约 9.53 秒回到 0.12 秒，muted=true、paused=false，确认真实循环。
- `bun test src/widgets/AuthForm.test.tsx`：4 项通过，覆盖登录成功、失败恢复、双密码校验及注册→OTP 粘贴自动验证。仅替换服务调用，不提交真实账号信息。
- `bun run typecheck`、`bun run build`、`git diff --check` 通过。lint 无错误，有独立 Hero Lab 的既有标签警告。
- 额外 DS 契约测试为 13 通过、1 失败：已有 `workspace.css` 的 `.note-organize-label` 使用 `translateY(0.0625rem)`，与测试的全文件字符串禁令冲突；已在任务开始的 HEAD 复核存在，本次不改其视觉或测试规则。
- 本次未提交真实邮箱登录、注册或 Google OAuth；这些网络认证结果不属于此次视觉验证结论。

## 2026-09-22 细节精修

- 标题改为「把此刻的想法 / 写下来」，移除两行末尾标点；标题与 384px 卡片共用同一中心线，不靠位置偏移补偿。
- 输入框 hover 和 focus 使用同一圈 3px、12% 墨蓝光影与 1px 提亮边线；覆盖 Landing 通用 focus outline，避免原来的双重描边。密码框完整外壳统一反馈，眼睛始终透明无背景，只由灰色变为近黑前景色。
- 增加「忘记密码？」原生 type=button 占位，无点击逻辑。标准高度下卡片内边距与表单间距放宽，卡片从 391px 增至 471px；接触影、环境影、下投影逐层形成轻实体感。矮屏收紧排版，1280×720 仍完整落在首屏。
- 删除视频按钮及其播放状态、事件和手动控制代码，只使用原生 autoPlay/muted/loop/playsInline。
- Turnstile 当前未接入，不显示模拟验证。它不会随部署自动启用，需要正式域名/Site Key、Supabase CAPTCHA Secret 和前端 captchaToken 提交一起完成；Managed 模式由 Cloudflare 判断是否要求点击。配置边界见 [AUTH_SETUP.md](../../AUTH_SETUP.md)。
- 本次内置浏览器检查 1440×1000、1280×720、390×844，确认无横向溢出；实际 hover 未聚焦输入框、聚焦后轮廓、眼睛 hover/显隐、忘记密码无操作及无控件视频自动播放均已验证。
- 本次 `bun run typecheck`、`bun run build`、`git diff --check` 通过；既有 AuthForm 4 项回归测试全部通过。lint 无错误，保留独立 Hero Lab 的既有标签警告。本次只调整界面，未新增真实验证码服务或密码重置调用。

## 三任务顺序收尾复核

- 营销动效已有独立提交 `f909bfe`；Toast/Canvas 反馈随后独立提交 `f8aaee8`。登录迁移与上述细节精修单独提交，共享文档按职责拆分，未混入通知业务改动。
- 最终工作区类型检查、构建通过；Toast/Canvas/AuthForm 共 30 项回归与 Motion 16 项回归通过。Lint 仅保留 Hero Lab Controls 的既有标签警告。
- 本轮浏览器重新检查输入框真实 hover/focus 光圈、眼睛 hover 近黑且透明无背景、忘记密码点击留在 `/login`，视频自动进入播放且 muted/loop 为真、controls 为假；390px 下页面 scrollWidth 为 390px，卡片宽 350px。
- 浏览器截图接口仍超时；Toast 在减少动态模式下验证三条完整展开和 46px 高度，不能将其当作普通动画流畅度或截图视觉验收。前两节的首版与精修测量为原任务记录，本段才是收尾重验结果。
- 未发送真实认证请求；忘记密码仍按要求只占位，Turnstile 仍未接入。已核对 Supabase 官方 CAPTCHA 文档，正式启用需要前端 token 与后台配置配合。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
