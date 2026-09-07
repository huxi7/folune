/**
 * [INPUT]: 依赖浏览器 View Transitions API（document.startViewTransition）与 memo 身份
 * [OUTPUT]: 对外提供纸壳/纸内正文两个纸面名字、本地内容 transitionContent、同文档 runViewTransition 与跨路由 navigateWithPaperTransition，把纸张身份和四种方向统一交给浏览器/CSS
 * [POS]: pages 的纸面过渡唯一入口；不复制 DOM、不测量矩形，集中处理并发跳过、方向标记与路由过渡收尾，避免各调用方各自留下不同节奏
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { flushSync } from "react-dom";
type ViewTransitionHandle = {
  finished: Promise<void>;
  skipTransition: () => void;
};

type StartViewTransition = (update: () => void) => ViewTransitionHandle;

type ViewTransitionDocument = Document & {
  activeViewTransition?: ViewTransitionHandle | null;
  startViewTransition?: StartViewTransition;
};

type ViewTransitionNavigate = (
  to: string,
  options: { viewTransition: true },
) => void | Promise<void>;

/*
 * 展开与收起不是同一件事的正反两遍: 打开是用户要看东西, 值得从容; 关闭是用户看完了,
 * 该立刻让路。方向写进 html 上的一个属性, 由 CSS 决定各自的时长与曲线 —— 普通路由
 * 跳转不带这个标记, 因此自然走中性节奏。
 */
export type PaperTransitionKind =
  | "expand"
  | "collapse"
  | "to-editor"
  | "to-canvas";

let active: ViewTransitionHandle | null = null;
let routeSequence = 0;

const markKind = (kind: PaperTransitionKind | undefined) => {
  const root = document.documentElement;
  if (kind === undefined) delete root.dataset.paperTransition;
  else root.dataset.paperTransition = kind;
};

/*
 * 一个名字只能同时属于一个元素, 所以卡片与预览按 memo 身份各自成名: 预览打开时卡片
 * 让出这个名字, 浏览器于是把"关掉的那张卡片"和"打开的那张纸"认成同一个东西。
 * memo id 是 UUID, 可能以数字开头, 而自定义标识符不许; 因此统一加前缀。
 *
 * 纸壳与纸内正文必须是两个名字。纸壳是纯色圆角矩形, 被拉伸看不出来; 正文是字, 位图化
 * 的字一放大就是"字在膨胀", 两端同时膨胀再叠在一起就是用户说的"突然弹出来"。分成两个
 * 名字之后, 正文自己成一组, 由 CSS 按原始尺寸绘制并交给纸壳的取景框裁切 —— 纸长大,
 * 露出更多正文。命名后代会被提出祖先的截图, 所以纸壳那张图天然是一张没有字的空白纸。
 *
 * 除此之外谁都不许拥有名字。过渡层的兄弟顺序由"被捕获的先后"决定, 与 z-index 和 DOM
 * 嵌套无关: 只在新状态出现的名字一律排到最后。一个全屏遮罩若自带名字, 整段动画都会被
 * 它盖住, 用户看到的是一片空白然后结果"跳"出来。
 */
export const paperViewTransitionName = (memoId: string) => `paper-${memoId}`;
export const paperBodyViewTransitionName = (memoId: string) =>
  `paper-body-${memoId}`;


/*
 * 把 DOM 更新包进一次视图过渡, 成功返回 true。
 *
 * 为什么这件事必须交给浏览器: 卡片和预览是同一段内容的两套排版, 中间那段变形无论
 * 怎么手写都要复刻落点的全部渲染细节 —— 圆角形状、字形抗锯齿、阴影随缩放、容器查询
 * 下的字号、裁切边界。少一项就是一次可见的跳变, 而这张清单没有尽头。浏览器不需要
 * 复刻: 两端的截图都是它自己画的, 变形也由它自己插值, 所以结构上就对不错。
 *
 * 属性必须在 startViewTransition 之前挂上: 旧截图在那一刻已经拍下, 而这个属性只被
 * ::view-transition-* 伪元素读取, 不改变真实 DOM 的任何一像素, 因此两端截图都干净。
 *
 * 连开连关不排队: 新手势直接跳过上一段, 不留残影也不叠动画。
 */
export const runViewTransition = (
  update: () => void,
  kind?: PaperTransitionKind,
): boolean => {
  if (typeof document === "undefined") return false;
  const start = (document as ViewTransitionDocument).startViewTransition;
  if (typeof start !== "function") return false;
  active?.skipTransition();
  markKind(kind);
  const handle = start.call(document, update);
  active = handle;
  const settle = () => {
    // 后来者已经改写过标记, 就轮不到这一段清理: 清了会把新方向抹成中性节奏
    if (active !== handle) return;
    active = null;
    markKind(undefined);
  };
  void handle.finished.then(settle, settle);
  return true;
};

const nextFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
});

/*
 * React Router 必须自己创建跨路由 View Transition；这里不能替它包 startViewTransition，
 * 但必须在 navigate 之前写入方向，并一直保留到浏览器的过渡真正结束。否则 CSS 在中途
 * 退回中性节奏，预览→编辑和笔记→画布又会变成同一套生硬交叉淡换。
 *
 * activeViewTransition 在路由提交后的下一帧才稳定可见；取不到时用 360ms 的有界兜底，
 * 它只延后标记清理，不阻塞导航或用户操作。sequence 保证快速连续导航不会被旧任务清掉。
 */
export const navigateWithPaperTransition = async (
  navigate: ViewTransitionNavigate,
  to: string,
  kind: Extract<PaperTransitionKind, "to-editor" | "to-canvas">,
): Promise<void> => {
  if (typeof document === "undefined") {
    await navigate(to, { viewTransition: true });
    return;
  }

  active?.skipTransition();
  const sequence = ++routeSequence;
  markKind(kind);
  try {
    await navigate(to, { viewTransition: true });
    await nextFrame();
    const handle = (document as ViewTransitionDocument).activeViewTransition;
    if (handle !== null && handle !== undefined) {
      active = handle;
      await handle.finished.catch(() => undefined);
      if (active === handle) active = null;
    } else {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 360));
    }
  } finally {
    if (routeSequence === sequence) markKind(undefined);
  }
};

/** 普通本地内容切换：截图不保留旧 React 会话，更新本身只执行一次。 */
export const transitionContent = (update: () => void): void => {
  if (!runViewTransition(() => flushSync(update))) update();
};
