/**
 * [INPUT]: 依赖 Bun test、workspaceMotion 语义 token、Canvas/Workspace/Dialog/Cord reduced-motion CSS 与 Paper/Canvas 路由协调器源码
 * [OUTPUT]: 锁定标准时长/spring/stagger、纸面零过冲、纸壳等比取景与正文永不缩放、交接严格互补、四方向世界先落定、当前曲线不变、两条跨路由纸面通道不丢失、入口 bootstrap 在单次 Canvas 挂载内不漂移、只有纸与纸内正文拥有过渡身份、画布会话只认登录用户与画布，并证明 Reduced Motion 取消空间位移与路径绘制
 * [POS]: pages 的统一 Motion Language 回归门禁；防止组件重新发明时长、给遮罩单独命名而盖住正在放大的纸、把正文当图片拉伸，或以缩短原空间 keyframe 冒充 reduced-motion
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  motionDuration,
  reducedFadeTransition,
  spatialSpring,
  staggerMaxMs,
  staggerStepMs,
} from "./workspaceMotion";

const stylesDir = join(import.meta.dir, "../styles");
const canvasCss = readFileSync(join(stylesDir, "knowledge-canvas.css"), "utf8");
const cordCss = readFileSync(join(stylesDir, "cord.css"), "utf8");
const designSystemCss = readFileSync(join(stylesDir, "design-system.css"), "utf8");
const workspaceCss = readFileSync(join(stylesDir, "workspace.css"), "utf8");
const notePaperCss = readFileSync(join(stylesDir, "note-paper.css"), "utf8");
const dialogTsx = readFileSync(
  join(import.meta.dir, "../shared/design-system/components/Dialog.tsx"),
  "utf8",
);
const coordinatorTs = readFileSync(
  join(import.meta.dir, "../widgets/KnowledgeCanvas/useCanvasSessionCoordinator.ts"),
  "utf8",
);
const canvasRouteCoordinatorTs = readFileSync(
  join(import.meta.dir, "CanvasRouteCoordinator.tsx"),
  "utf8",
);
const canvasEntryTs = readFileSync(
  join(import.meta.dir, "useMemoCanvasEntry.ts"),
  "utf8",
);

// 视图过渡的节奏全部住在 knowledge-canvas.css 末尾一段, 从声明节奏的那条 html 规则起
const vtCss = canvasCss.slice(canvasCss.indexOf("\nhtml {\n  --paper-morph:"));

describe("Workspace Motion Language", () => {
  test("语义时长、spring 与 stagger 只有一套标准", () => {
    expect(motionDuration).toEqual({
      microEnter: 0.16,
      microExit: 0.13,
      panelEnter: 0.22,
      panelExit: 0.17,
      press: 0.09,
    });
    expect(spatialSpring).toMatchObject({
      bounce: 0.04,
      type: "spring",
      visualDuration: 0.36,
    });
    expect(reducedFadeTransition.duration).toBe(0.09);
    expect(staggerStepMs).toBe(32);
    expect(staggerMaxMs).toBe(128);
  });
  /*
   * 卡片 ↔ 预览、预览 ↔ 写作区、写作区 ↔ 画布全部交给浏览器的视图过渡: 截图、变形与
   * 交叉淡换都由同一个渲染器完成, 因此不存在"落点对不上"。这里只锁那几条只要写反就会
   * 被眼睛立刻抓住的规矩, 而每一条都对着一次真实的返工。
   */
  test("承载正文的表面一律不过冲", () => {
    const curves = vtCss.match(/cubic-bezier\([^)]*\)/g) ?? [];
    expect(curves.length).toBeGreaterThan(0);
    for (const curve of curves) {
      const [, y1, , y2] = curve
        .slice("cubic-bezier(".length, -1)
        .split(",")
        .map((value) => Number(value.trim()));
      // 纸的边界就是正文的边界, 过冲等于整段正文缩过头再弹回来
      expect(y1).toBeLessThanOrEqual(1);
      expect(y2).toBeLessThanOrEqual(1);
    }
  });
  /*
   * 纸壳可以被拉伸: 命名的后代被提出祖先的截图, 所以那张图里本来就没有字, 拉一个纯色
   * 圆角矩形看不出任何东西 —— 但必须等比(cover), 非等比会把圆角拉成椭圆。
   * 正文不行: 位图化的字一放大就是"字在膨胀"。两端都按原始尺寸画, 再交给取景框裁切。
   */
  test("纸壳等比取景, 纸内正文永不缩放", () => {
    const shell = vtCss.slice(vtCss.indexOf("::view-transition-old(.paper),"));
    expect(shell.slice(0, 200)).toContain("object-fit: cover");
    expect(shell.slice(0, 200)).toContain("object-position: top center");
    const body = vtCss.slice(vtCss.indexOf("::view-transition-old(.paper-body),"));
    expect(body.slice(0, 200)).toContain("object-fit: none");
    // 取景框就是 image-pair: 它 inset:0 于所在的组, 尺寸恰好是这一帧的正文矩形
    expect(vtCss).toContain("::view-transition-image-pair(.paper-body) {\n  overflow: clip;");
  });
  /*
   * 浏览器用 plus-lighter 混合两张截图, 所以只有严格互补才能保证任何时刻总不透明度都是
   * 1: 差一点就是中途发灰或两套字同时半透明地叠着。
   */
  test("两端排版的交接严格互补", () => {
    const stops = (name: string) => {
      const at = vtCss.indexOf(`@keyframes ${name} {`);
      expect(at).toBeGreaterThanOrEqual(0);
      const body = vtCss.slice(at, vtCss.indexOf("}\n", at));
      return [...body.matchAll(/([\d%,\s]+)\{\s*opacity:\s*([\d.]+);/g)]
        .map((m) => [m[1]!.trim(), Number(m[2])] as const);
    };
    const out = stops("paper-handoff-out");
    const into = stops("paper-handoff-in");
    expect(out.length).toBe(into.length);
    for (let i = 0; i < out.length; i += 1) {
      expect(out[i]![0]).toBe(into[i]![0]);
      expect(out[i]![1] + into[i]![1]).toBe(1);
    }
  });
  /*
   * 世界先落定。遮罩/画布是环境的状态改变, 不是与纸同行的物体: 摊到整段里, 它就全程跟
   * 纸抢注意力; 而"留到最后才揭开"更糟 —— 用户会盯着一张纸在空无一物的底上缩小, 那正是
   * 他说的"没有动效"。因此每个方向的世界都不长于纸的形变, 收起还要短于展开。
   */
  test("世界先落定, 四个方向都不许陪着纸走完全程", () => {
    const scope = (selector: string) => {
      const at = vtCss.indexOf(selector);
      expect(at).toBeGreaterThanOrEqual(0);
      return vtCss.slice(at, vtCss.indexOf("}", at));
    };
    const ms = (block: string, name: string, fallback: number) => {
      const match = new RegExp(`${name}:\\s*(\\d+)ms`).exec(block);
      return match === null ? fallback : Number(match[1]);
    };
    const base = scope("\nhtml {");
    const baseMorph = ms(base, "--paper-morph", 0);
    const baseWorld = ms(base, "--paper-world", 0);
    expect(baseMorph).toBeGreaterThan(0);
    expect(baseWorld).toBeLessThanOrEqual(baseMorph);
    const collapse = scope('html[data-paper-transition="collapse"] {');
    const collapseMorph = ms(collapse, "--paper-morph", baseMorph);
    expect(collapseMorph).toBeLessThan(baseMorph);
    for (const kind of ["expand", "collapse", "to-canvas", "to-editor"]) {
      const block = scope(`html[data-paper-transition="${kind}"] {`);
      const morph = ms(block, "--paper-morph", baseMorph);
      expect(ms(block, "--paper-world", baseWorld)).toBeLessThanOrEqual(morph);
    }
    // 展开时世界必须一帧内退场, 否则其他卡片会陪着纸放大
    expect(ms(scope('html[data-paper-transition="expand"] {'), "--paper-world", baseWorld))
      .toBeLessThanOrEqual(72);
    expect(vtCss).toContain("--paper-world-old: canvas-world-old-immediate;");
  });
  test("保留当前纸面曲线, 两条跨路由纸面通道都由路由自己接管", () => {
    // 这是用户已经确认过的当前效果: 本次只恢复路径, 不把曲线换回上一版。
    expect(vtCss).toContain(
      "--paper-morph-ease: cubic-bezier(0.4, 0, 0.2, 1);",
    );
    expect(vtCss).toContain('html[data-paper-transition="collapse"] {\n    --paper-morph: 240ms;');

    // 预览 → 编辑区: navigate 自己创建跨路由 View Transition。
    expect(canvasRouteCoordinatorTs).toContain(
      "import { navigateWithPaperTransition } from \"./viewTransition\";",
    );
    expect(canvasRouteCoordinatorTs).toContain('"to-editor"');
    // 一次性缓存被消费或下一轮重新写入，都不能改写仍在场的 Canvas 入口快照。
    expect(canvasRouteCoordinatorTs).toContain(
      "const [entryBootstrap] = useState(() => bootstrap);",
    );
    expect(canvasRouteCoordinatorTs).toContain("bootstrap={entryBootstrap}");

    // 编辑区 → Canvas 卡片: 进入与返回都走同一个 to-canvas 入口, 不再退化为硬切。
    expect(canvasEntryTs.match(/navigateWithPaperTransition\(/g)?.length).toBe(2);
    expect(canvasEntryTs).toContain('"to-canvas"');
    expect(canvasEntryTs).toContain("const returnCanvas = async");
  });
  /*
   * 这一条锁的是让"展开"整段变成一片空白的那次事故。
   *
   * 过渡层的兄弟顺序由被捕获的先后决定, 与 z-index、DOM 嵌套无关: 只在新状态出现的名字
   * 一律排到最后。于是自带名字的全屏遮罩稳稳盖住那张正在放大的纸, 用户看到一片空白, 过渡
   * 结束才"跳"出结果。遮罩留在 root 那张截图里, 磨砂玻璃反而完整可用 —— backdrop-filter
   * 采样的就是同一次绘制里它身后的画布。
   */
  test("只有纸与纸内正文拥有过渡身份", () => {
    const named = readFileSync(join(import.meta.dir, "viewTransition.ts"), "utf8");
    expect(named).toContain("paperViewTransitionName");
    expect(named).toContain("paperBodyViewTransitionName");
    for (const css of [canvasCss, designSystemCss, workspaceCss]) {
      expect(css).not.toContain("canvas-preview-veil");
    }
    expect(dialogTsx).not.toContain("viewTransitionName");
    // 遮罩因此可以留着设计系统那层磨砂玻璃, 不需要为截图退化成一块不透明色
    const veil = designSystemCss.slice(
      designSystemCss.indexOf('.ds-dialog-overlay[data-motion="none"]'),
    );
    expect(veil).toContain("animation: none;");
    expect(veil).not.toContain("backdrop-filter: none");
    expect(designSystemCss).toContain("@supports not (view-transition-name: none)");
  });
  /*
   * 路由已经拥有这次过渡, 纸内不该再叠第二层: 否则 PaperSurface 自己的入场会被拍在
   * opacity .82 的中间态, 过渡结束真实 DOM 再跳一次。
   */
  test("路由形变期间纸内不再叠自己的入场", () => {
    expect(vtCss).toContain("html[data-paper-transition] .paper-content-transition");
    expect(notePaperCss).toContain("view-transition-class: paper;");
    expect(notePaperCss).toContain("view-transition-class: paper-body;");
    expect(workspaceCss).toContain(".paper-surface { view-transition-class: paper;");
    expect(workspaceCss).toContain(".paper-content-transition { view-transition-class: paper-body;");
  });
  /*
   * 一次画布会话的身份只有 (登录用户, 这张画布)。别的东西一律不许结束它 —— 上层记录一次
   * 返回描述就重建会话, 代价是 resetSession() 清空文档与预览、掐掉正在飞的保存, 而用户
   * 看到的是"点了编辑原文, 预览凭空消失, 结果页面直接弹出来"。
   */
  test("画布会话只认登录用户与画布本身", () => {
    const deps = /\}, \[([^\]]*)\]\);/g;
    const matches = [...coordinatorTs.matchAll(deps)].map((m) => m[1]!.replace(/\s+/g, ""));
    expect(matches).toContain("accessToken,beginSession,canvasId,resetSession,userId");
    for (const list of matches) {
      expect(list).not.toContain("restore");
      expect(list).not.toContain("entryChrome");
      expect(list).not.toContain("bootstrap");
    }
  });
  test("Reduced Motion 使用纯淡入并关闭路径绘制", () => {
    expect(canvasCss).toContain("@keyframes canvas-reduced-fade");
    expect(canvasCss).toContain("animation: canvas-reduced-fade 90ms");
    expect(canvasCss).toContain("@keyframes canvas-node-content-in");
    expect(canvasCss).toContain("var(--canvas-motion-content-delay, 0ms)");
    expect(canvasCss).toContain(
      '.canvas-card[data-motion-state="source-confirm"] { animation-duration: 90ms;',
    );
    expect(cordCss).toContain(
      ".cord-line-draw { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }",
    );
    expect(workspaceCss).toContain("animation-duration: 90ms; animation-delay: 0ms;");
    expect(designSystemCss).toContain(
      '.ds-dialog-overlay[data-motion="none"] { animation-duration: 90ms; }',
    );
    // 方向覆盖住在 no-preference 里, 这里只需压住基线; root 带名字, 通配那条压不过它
    const reduceBlock = vtCss.slice(
      vtCss.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduceBlock).toContain("::view-transition-group(root)");
    expect(reduceBlock).toContain("--paper-morph: 90ms");
    expect(reduceBlock).toContain("animation-duration: 90ms");
  });
});
