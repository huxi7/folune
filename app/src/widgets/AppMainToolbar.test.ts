/**
 * [INPUT]: 读取 AppMainToolbar、workspace.css 与 brand-spec 的命令层级和页面级共享悬浮提示/真实快捷键契约
 * [OUTPUT]: 锁定 Toolbar 不再接收拼接路径；整理是排在首位的 中性核心动作（有图标与文字、不是 Filled Primary、静止无容器身体），进入 Canvas 收成无标签 32px 图标，三枚图标组成 4px 紧凑簇，整理与簇也以 4px 相隔，弹层型「更多」排在簇尾，归档状态是左侧身份段的独立元素，命令不带选中指示，顶栏 control 的 32px 高度只声明一次且中性 hover/不透明press 只有一个答案，sticky 钉在 Panel 内缩线，顶栏与 Paper 同表面同颜色且永远不画底边线，凝结只有一个被动画的进度且下缘软边的高度/模糊/遮罩都乘它
 * [POS]: Paper Toolbar 结构/样式静态回归门禁；不发起导航、整理请求或文件树事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const toolbar = readFileSync(join(import.meta.dir, "AppMainToolbar.tsx"), "utf8");
const viewMenu = readFileSync(join(import.meta.dir, "MarkdownViewMenu.tsx"), "utf8");
const workspaceCss = readFileSync(join(import.meta.dir, "../styles/workspace.css"), "utf8");

/** L3 头部之后的代码: 界面文案的断言不能被"内部能力仍是 AI"这类契约描述干扰 */
const toolbarCode = toolbar.slice(toolbar.indexOf("*/") + 2);

/** 取含某个 className 的那一行 JSX: `onClick={() => ...}` 里的箭头会让 `[^>]*` 提前收尾 */
const jsxLineWith = (source: string, marker: string): string =>
  source.split("\n").find((line) => line.includes(marker)) ?? "";

describe("AppMainToolbar", () => {
  test("Toolbar 通过明确 presentation/标题 props，不再接收 toolbarTitle 路径泥团", () => {
    expect(toolbar).toContain("organizePresentation");
    expect(toolbar).toContain("onLocateArchive");
    expect(toolbar).not.toContain("toolbarTitle");
    expect(toolbar).not.toContain("MagicWandIcon");
  });

  test("整理是唯一带文字的核心动作, 但不是 Filled Primary", () => {
    const organize = jsxLineWith(toolbar, 'className="note-organize-button"');
    expect(organize).toContain('<span className="note-organize-label">{t("整理", "Organize")}</span>');
    expect(organize).toContain("icon={OrganizeNoteIcon}");
    expect(organize).toContain('size="default"');
    expect(organize).toContain('variant="ghost"');
    // 一张安静白纸上的永久色块会跟文件库的「新建」抢主角: 顶栏里一个 Primary 都不该有
    expect(toolbar).not.toContain('variant="primary"');
    // loading 与快捷键是它的状态与合同, 换材质不许顺手丢掉
    expect(organize).toContain("loading={props.organizing}");
    expect(organize).toContain('aria-keyshortcuts="Meta+Enter Control+Enter"');
    // 界面陈述用户的结果: 可见文字、tooltip 与可访问名都不写「AI 整理」
    expect(toolbarCode).toContain('content={t("整理笔记", "Organize note")}');
    expect(toolbarCode).toContain('keys={["mod", "Enter"]}');
    expect(toolbarCode).toContain('keys={["mod", "E"]}');
    expect(organize).not.toContain('title=');
    expect(toolbarCode).not.toContain("AI 整理");
  });

  test("整理排在命令区最左: 核心动作是这一簇第一个被扫到的东西", () => {
    const trailing = toolbar.slice(toolbar.indexOf('className="note-view-actions"'));
    expect(trailing.indexOf("note-organize-button")).toBeLessThan(trailing.indexOf("note-explore-button"));
  });

  test("整理继承 ghost 中性前景，不再覆写品牌色", () => {
    const organize = /\.note-organize-button\.ds-button \{[\s\S]*?\n  \}/.exec(workspaceCss)?.[0] ?? "";
    expect(organize).not.toBe("");
    // 静止那三项来自 ghost 基类的透明底座, 因此这里一条都不许自己写出来
    expect(organize).not.toMatch(/^\s*background:/m);
    expect(organize).not.toMatch(/^\s*border:/m);
    expect(organize).not.toMatch(/box-shadow/);
    expect(organize).not.toContain("primary");
    expect(organize).not.toContain("--button-foreground-rest");
    // 颜色只能来自既有 token: 没有 #hex, 也没有第二套品牌色
    expect(organize).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(workspaceCss).not.toContain(".note-organize-button.ds-button:not(:disabled):hover");
  });

  test("进入 Canvas 是无标签 32px 图标, 与整理不再同尺寸同变体同形状", () => {
    const explore = /<Button[^>]*className="note-explore-button"[^>]*\/>/.exec(toolbar)?.[0] ?? "";
    // 自闭合即没有文字子节点; 导航是名词, 一个图标说得完
    expect(explore).not.toBe("");
    expect(explore).toContain('size="square"');
    expect(explore).toContain('variant="ghost"');
    expect(toolbar).not.toContain("进入 Canvas</Button>");
    // 图标按钮的可访问名只剩 aria-label 一个来源, 丢了它就是一颗没有名字的按钮
    expect(explore).toContain('aria-label={t("进入 Canvas", "Open Canvas")}');
    expect(explore).not.toContain("title=");
    expect(toolbarCode).not.toContain('<WarmTooltipGroup>');
    expect(toolbarCode).toContain('content={t("进入 Canvas", "Open Canvas")}');
  });

  test("弹层型「更多」排在簇尾: 菜单右对齐垂下, 别处都会悬在同侧控件头上", () => {
    const trailing = toolbar.slice(toolbar.indexOf('className="note-view-actions"'));
    const viewMenuAt = trailing.indexOf("<MarkdownViewMenu");
    expect(viewMenuAt).toBeGreaterThan(trailing.indexOf("note-explore-button"));
    expect(viewMenuAt).toBeGreaterThan(trailing.indexOf("note-organize-button"));
    // 视图菜单内部「更多」也必须在阅读切换之后, 否则菜单会悬在同侧控件头上
    expect(viewMenu.indexOf("DotsThreeIcon")).toBeGreaterThan(viewMenu.indexOf("BookOpenTextIcon"));
    // 菜单向纸内展开: 与触发器右边缘对齐, 因此簇尾是它唯一不越界的位置
    expect(/\.note-more-menu \{[^}]*right: 0/.test(workspaceCss)).toBe(true);
  });

  test("整理与图标簇统一用 4px, 顶栏静止时不多出一条竖线", () => {
    expect(workspaceCss).toContain(".note-view-actions { display: flex; flex-shrink: 0; align-items: center; gap: var(--space-1); }");
    expect(workspaceCss).toContain(".note-view-cluster { display: flex; flex-shrink: 0; align-items: center; gap: var(--space-1); }");
    expect(workspaceCss).toContain(".markdown-view-menu { display: flex; flex-shrink: 0; align-items: center; gap: var(--space-1); }");
    // 分组只由两层 flex gap 表达, 不再让额外 margin 产生第二个答案
    expect(workspaceCss).not.toContain("gap: var(--control-cluster-gap); margin-inline-start: var(--space-2);");
  });

  test("顶栏 control 的 32px 高度只声明一次, 且不住在任何一个控件身上", () => {
    // 高度是顶栏的属性: 整理、三枚图标与归档落点从同一条规则拿到同一个 32px
    expect(workspaceCss).toContain(".app-main-toolbar .ds-button,\n  .app-main-toolbar .archive-status { height: var(--control-height-compact); min-height: var(--control-height-compact); }");
    // 于是没有任何一个控件再自报身高 —— 自报就是给"顶栏多高"添第二个答案
    for (const rule of [
      /\.note-organize-button\.ds-button \{[\s\S]*?\n  \}/,
      /\n  \.archive-status \{[^}]*\}/,
      /\.toolbar-return-canvas\.ds-button\.ds-button-size-square,[\s\S]*?\}/,
    ]) {
      expect(rule.exec(workspaceCss)?.[0] ?? "").not.toMatch(/(^|[^-])height:/);
    }
  });

  test("顶栏无标签图标只有一份 32px 几何", () => {
    const geometry = /\.toolbar-return-canvas\.ds-button\.ds-button-size-square,[\s\S]*?\}/.exec(workspaceCss)?.[0] ?? "";
    expect(geometry).toContain(".note-explore-button.ds-button.ds-button-size-square,");
    // 只补正方形另一维: 容器、hit area 与 16px 图标因此共用同一个中心
    expect(geometry).toContain(".note-view-icon-button.ds-button.ds-button-size-square { width: var(--control-height-compact); min-width: var(--control-height-compact); }");
    // 圆角由 .ds-button 基类给出, 这三个不再各自重申一遍
    expect(geometry).not.toContain("border-radius");
    // "顶栏图标多大"只允许有一个答案
    expect(workspaceCss.match(/\.note-view-icon-button\.ds-button\.ds-button-size-square/g)).toHaveLength(1);
  });

  test("整理与其他命令共用中性 hover/press 反馈", () => {
    const neutral = /\.note-organize-button\.ds-button,\n  \.toolbar-return-canvas\.ds-button,\n  \.note-explore-button\.ds-button,\n  \.note-view-icon-button\.ds-button \{[^}]*\}/
      .exec(workspaceCss)?.[0] ?? "";
    expect(neutral).not.toBe("");
    // ghost 基类给的是 --muted, 归档落点给的是 --interactive-hover, 而它们就挨在一起
    for (const token of [
      "--button-surface-hover: var(--interactive-hover)",
      "--button-face-top-hover: var(--interactive-hover)",
      "--button-face-bottom-hover: var(--interactive-hover)",
      "--button-surface-active: var(--secondary)",
    ]) expect(neutral).toContain(token);
    // 整理也属于中性命令，共享规则不引用 primary
    expect(neutral).not.toContain("primary");
    // 归档落点是按钮, 按下就必须给同一份"原地收紧" —— 时长与比例都不新写数值
    const press = /\.archive-status:active \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    expect(press).toContain("transform: scale(var(--press-scale))");
    expect(press).toContain("transition-duration: var(--motion-press)");
    // hover/press 的过渡时长共读 motion-fast, 顶栏里没有第二条曲线或第二个弹簧
    expect(/\n  \.archive-status \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "")
      .toContain("transform var(--motion-fast) var(--ease-standard)");
    // 额外光晕、明显外影与装饰层一律不进顶栏
    expect(neutral).not.toContain("glow");
    expect(neutral).not.toContain("box-shadow");
  });

  test("归档状态住在左侧身份段, 因为它是归档线的起点: 放右侧线会横穿整张纸", () => {
    const leading = /app-main-toolbar-leading"[\s\S]*?<\/div>/.exec(toolbar)?.[0] ?? "";
    const trailing = toolbar.slice(toolbar.indexOf('className="note-view-actions"'));
    expect(leading).toContain("<ArchiveStatus");
    expect(trailing).not.toContain("<ArchiveStatus");
    // 标题在静止时透明但仍占位, 因此落点排在它之前才有稳定的横坐标
    expect(leading.indexOf("<ArchiveStatus"))
      .toBeLessThan(leading.indexOf("app-main-toolbar-title"));
  });

  test("纸上视图菜单不再与 Toolbar 命令簇共用类名，命令没有任何选中下划线", () => {
    expect(viewMenu).toContain('className="markdown-view-menu"');
    expect(viewMenu).not.toContain('className="note-view-actions"');
    // 那条柔光下划线按后代匹配, 同时亮在视图切换与"更多"两个图标下, 且两态都亮 —— 不指示任何状态
    expect(workspaceCss).not.toContain(".note-view-icon-button:first-child::after");
    expect(workspaceCss).not.toContain(".note-view-icon-button:first-child,");
  });

  test("sticky 钉在 Panel 内缩线上, 不是 y=0", () => {
    const bar = /\.app-main-toolbar \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    expect(bar).toContain("position: sticky");
    expect(bar).toContain("top: var(--workspace-panel-inset)");
    expect(bar).not.toContain("top: 0");
  });

  test("凝结区间只有一份数值, 三个消费者都从纸上那三个变量读", () => {
    const paper = /\.app-main-panel\.paper-surface \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    expect(paper).toContain("--toolbar-condense-from: 24px");
    expect(paper).toContain("--toolbar-condense-to: 80px");
    expect(paper).toContain("--toolbar-title-from: 36px");
    /*
     * 24 / 80 不是手感: 正文抵达顶栏下沿的时刻是 1px 纸边 + 正文上边距, 窄屏(上边距收到
     * 2rem)只有 33px。终点留在 96px 时实底根本来不及长满, 顶栏上方那条留白就会漏出半行字。
     * from 必须 ≤33, 且区间长度必须 ≤ 实底要走的 48px+inset, 否则实底追不上正文。
     */
    expect(Number(/--toolbar-condense-from: (\d+)px/.exec(paper)?.[1])).toBeLessThanOrEqual(33);
    const from = Number(/--toolbar-condense-from: (\d+)px/.exec(paper)?.[1]);
    const to = Number(/--toolbar-condense-to: (\d+)px/.exec(paper)?.[1]);
    expect(to - from).toBeLessThanOrEqual(48 + 16);
    // 标题必须晚于实底起步: 它出现的理由是"正文标题已经看不见了"
    expect(Number(/--toolbar-title-from: (\d+)px/.exec(paper)?.[1])).toBeGreaterThan(from);
    // 实底与 hairline 走 24–80, 标题晚 12px 起步但同一处收尾
    expect(workspaceCss).toContain("animation-range: var(--toolbar-condense-from) var(--toolbar-condense-to)");
    expect(workspaceCss).toContain("animation-range: var(--toolbar-title-from) var(--toolbar-condense-to)");
    expect(workspaceCss).not.toMatch(/animation-range:\s*\d+px/);
  });

  test("凝结只有一个被动画的量: 实底与软边都在消费点乘同一个 scroll progress", () => {
    // 被注册、被动画的只有进度本身: 多一个可以被单独改坏的量, 就多一种真空
    expect(workspaceCss.match(/@property --toolbar-/g)).toHaveLength(1);
    expect(workspaceCss).toContain('@property --toolbar-condense-progress {\n  syntax: "<number>";');
    expect(workspaceCss).toContain("from { --toolbar-condense-progress: 0; }");
    expect(workspaceCss).toContain("to { --toolbar-condense-progress: 1; }");
    // 旧的两个几何变量必须彻底消失, 否则"谁驱动软边"又有了第二个答案
    expect(workspaceCss).not.toContain("--toolbar-surface-reveal");
    expect(workspaceCss).not.toContain("--toolbar-edge-height");
    const pseudo = /\.app-main-toolbar::before \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    // 实底保持不透明, 高度是那个进度的读数
    expect(pseudo).toContain("height: calc(var(--toolbar-condense-progress) * var(--toolbar-condense-cover))");
    /*
     * 铺开的必须是纸本身, 因此只允许那一个 --paper-surface: 第二种表面一出现, 顶栏就从
     * "纸的上边距"变成了浮在纸上的一层, 而那是 §7 明文不做的东西。
     */
    expect(pseudo).toContain("background: var(--paper-surface)");
    expect(pseudo).not.toMatch(/background:(?!\s*var\(--paper-surface\))/);
    expect(pseudo).toContain("z-index: 0");
    expect(workspaceCss).toContain(".app-main-toolbar > * { position: relative; z-index: 1; }");
    expect(workspaceCss).toContain("animation-timeline: scroll(nearest block)");
    // CSS animation 默认 ease, 不显式写 linear 就不是"滚了一半就是一半"
    expect(workspaceCss).toContain("animation-timing-function: linear");
    // 进度型时间线忽略时间 duration: 写一个毫秒数只是让代码说一句浏览器不听的话
    for (const rule of [
      /\.app-main-toolbar \{ animation-name[^}]*\}/,
      /\.app-main-toolbar-title \{ animation-name[^}]*\}/,
    ]) {
      const declarations = rule.exec(workspaceCss)?.[0] ?? "";
      expect(declarations).toContain("animation-duration: auto");
      expect(declarations).not.toMatch(/animation-duration:\s*[\d.]/);
    }
    const keyframes = /@keyframes app-toolbar-fade-in \{[\s\S]*?\n  \}/.exec(workspaceCss)?.[0] ?? "";
    expect(keyframes).toContain("from { opacity: 0; }");
    expect(keyframes).toContain("to { opacity: 1; }");
    // 标题只淡入: 位移一律不许回来
    expect(keyframes).not.toContain("transform");
    expect(/\.app-main-toolbar-title \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "").not.toContain("transform");
  });

  test("顶栏永远不画底边线: 那条线会把顶栏读成一个随滚动变宽的物体", () => {
    /*
     * 纸在滚动中继续往窗口上方延伸, 所以顶栏上方那一片本来就是纸。一旦在下缘画一条线,
     * 眼睛就把「窗口上边 → 那条线」整段圈成一个物体, 顶栏于是从 48px 读成一整条 chrome。
     * 宽窄是物体才有的属性, 所以这条门禁盯的不是一行 CSS, 是"顶栏不是物体"这条法。
     */
    for (const rule of [
      /\.app-main-toolbar \{ position: sticky[^}]*\}/,
      /\.app-main-toolbar::before \{[^}]*\}/,
      /\.app-main-toolbar::after \{[\s\S]*?\n  \}/,
    ]) {
      const declarations = rule.exec(workspaceCss)?.[0] ?? "";
      expect(declarations).not.toBe("");
      expect(declarations).not.toContain("border-bottom");
      expect(declarations).not.toContain("box-shadow");
    }
    // 边界只由下缘软边表达, 顶栏因此也没有自己的背景
    expect(/\.app-main-toolbar \{ position: sticky[^}]*\}/.exec(workspaceCss)?.[0] ?? "")
      .toContain("background: transparent");
  });

  test("顶栏上方那条留白里只能是纸: 实底锚在下沿并向上盖过 sticky 线", () => {
    const paper = /\.app-main-panel\.paper-surface \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    /*
     * sticky 停在 Panel 内缩线上而不是 y=0, 于是顶栏上方永远留着一条 inset 高的带子;
     * 纸一往上滚, 那里就成了纸的内部, 正文从中穿过并被滚动容器上边缘切断 —— 那是
     * 「正文穿过 Toolbar」最刺眼的版本。所以凝结要盖的是顶栏加它上面那条 inset。
     */
    expect(paper).toContain("--toolbar-condense-cover: calc(var(--panel-header-height) + var(--workspace-panel-inset))");
    const pseudo = /\.app-main-toolbar::before \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    /*
     * 锚点必须是下沿: 从下沿往上长, 实底的下边界恒等于顶栏下边界, 于是软边的起点是常量、
     * hairline 也永远停在那条线上只随进度加深。改回 top 锚定会同时带回两件事: 顶栏上方
     * 永远盖不住, 以及一条淡线扫过按钮中间。
     */
    expect(pseudo).toContain("bottom: 0");
    expect(pseudo).not.toMatch(/(^|[^-])top: 0/);
    // 软边的起点因此不需要算, 它是常量
    const edge = /\.app-main-toolbar::after \{[\s\S]*?\n  \}/.exec(workspaceCss)?.[0] ?? "";
    expect(edge).toContain("top: 100%;");
    expect(edge).not.toContain("top: calc(");
  });

  test("软边从实底当前边界长出来, blur/纸色/遮罩同乘一个进度, 静止时一层都不剩", () => {
    const paper = /\.app-main-panel\.paper-surface \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    // 软边的两个数值只在纸上出现一次, 于是"软边多高、模糊多少"没有第二个答案
    expect(paper).toContain("--toolbar-edge-max: 16px");
    expect(paper).toContain("--toolbar-edge-blur: 6px");
    const edge = /\.app-main-toolbar::after \{[\s\S]*?\n  \}/.exec(workspaceCss)?.[0] ?? "";
    expect(edge).not.toBe("");
    // 起点就是实底下边界, 而那是个常量: 两者之间不存在能放进一段真空的缝
    expect(edge).toContain("top: 100%;");
    expect(edge).toContain("height: calc(var(--toolbar-condense-progress) * var(--toolbar-edge-max))");
    // 模糊半径也乘同一个进度, 因此不存在固定模糊带: 进度 0 就是 blur(0)
    expect(edge).toContain("backdrop-filter: blur(calc(var(--toolbar-condense-progress) * var(--toolbar-edge-blur)))");
    expect(edge).toContain("-webkit-backdrop-filter: blur(calc(var(--toolbar-condense-progress) * var(--toolbar-edge-blur)))");
    expect(edge).toContain("mask-image: linear-gradient(");
    expect(edge).toContain("-webkit-mask-image: linear-gradient(");
    // 顶端必须是满纸色: 低于 100% 就会在 hairline 底下透出一行鬼影
    expect(edge).toContain("var(--paper-surface) 0%,");
    // 纸色与遮罩都收在 100%: 软边下沿之下不留任何残留层
    expect(edge.match(/transparent 100%/g)).toHaveLength(3);
    // 每一个长度都来自进度乘 token, 块里一个裸像素都没有
    expect(edge).not.toMatch(/\d+px/);
    // 顶栏里唯一被允许的模糊就是这一处, 且它绝不是一个常数
    expect(workspaceCss).not.toMatch(/\.app-main-toolbar[^{]*\{[^}]*blur\((?!calc)/);
  });

  test("没有 scroll timeline 时只用一个哨兵软切, 哨兵高度不在 JS 里重写一遍", () => {
    expect(workspaceCss).toContain("@supports not (animation-timeline: scroll())");
    // 软切也只切那一个进度: 实底、hairline、软边、模糊与遮罩全都跟着它一起走完
    expect(workspaceCss).toContain(".app-main-toolbar { transition: --toolbar-condense-progress var(--motion-fast) linear; }");
    expect(workspaceCss).toContain('.app-main-toolbar[data-condensed="true"] { --toolbar-condense-progress: 1; }');
    expect(workspaceCss).toContain("height: calc(var(--toolbar-condense-to) - var(--workspace-panel-inset))");
    // 支持 scroll timeline 的浏览器连哨兵都不挂载
    expect(toolbarCode).toContain('CSS.supports("animation-timeline", "scroll()")');
    expect(toolbarCode).toContain("new IntersectionObserver");
    expect(toolbarCode).toContain("supportsScrollTimeline\n        ? null");
    // 只允许一次软切, 不许出现连续测量
    expect(toolbarCode).not.toContain("scrollTop");
    expect(toolbarCode).not.toContain("addEventListener(\"scroll\"");
  });

  test("顶栏不裁剪: 它要放得下垂下去的更多菜单, 也不能自己变成 nearest 滚动容器", () => {
    const toolbar = /\.app-main-toolbar \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    const leading = /\.app-main-toolbar-leading \{[^}]*\}/.exec(workspaceCss)?.[0] ?? "";
    // hidden 同时干掉两件事: 157px 的更多菜单被切成 0, 以及凝结时间线永远 inactive
    expect(toolbar).toContain("overflow: visible");
    expect(toolbar).not.toContain("overflow: hidden");
    expect(toolbar).not.toContain("overflow: clip");
    // 需要裁的只有标题; clip 不建立滚动容器, 因此标题淡入仍能找到 .paper-stage-scroll
    expect(leading).toContain("overflow: clip");
    expect(leading).not.toContain("overflow: hidden");
  });
});
