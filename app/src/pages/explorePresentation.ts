/**
 * [INPUT]: 依赖 widgets/radialLayout 的 radialLayout 分侧/角度、widgets/cordGeometry 的 cordAnchor/CordBox
 * [OUTPUT]: 对外提供 EXPLORE_STAGE_MOTION 时序、EXPLORE_PENDING_* 骨架阶梯、exploreCloseness 置信度→亲疏、planExploreStage 舞台排布与 ExploreStagePlan/ExploreStageSlot 类型
 * [POS]: app/src/pages 的探索态表现策略边界，与 organizePresentation 同位；只回答「纸退多远、候选站哪里、理由落在哪、谁先变实」，不碰 React/DOM/Store 因此可在无浏览器下单测。距离是这个功能唯一的信息通道，所以此处对 radialLayout 做了一次刻意的分工: 它负责分侧、角度与避开竖直方向，而半径语义在这里按「用户读到的距离」重写——它的半径自矩形边缘起算，纸高瘦时边缘离中心忽远忽近，同一半径看起来并不同远
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cordAnchor, type CordBox } from "../widgets/cordGeometry";
import { radialLayout } from "../widgets/radialLayout";

/**
 * 时序常量集中在此，不内联进组件或 CSS: 退场计时器、documentView 归位与卡片错峰
 * 必须读同一份数字，否则纸张回位与编辑器复原会错开。
 */
export const EXPLORE_STAGE_MOTION = {
  /** 卡片滑向真实距离的错峰步长 */
  glideStaggerMs: 60,
  /** 骨架→实卡的错峰步长；一起塌下来就没有「逐个被读懂」的感觉 */
  materializeStaggerMs: 110,
  /** 骨架变实前的统一起始延迟，让位移先走一段 */
  materializeStartMs: 140,
  /** 纸张退后/回位时长，与 --motion-spatial 同值；退场计时器据此归还编辑器 */
  retreatMs: 320,
} as const;

/**
 * 等待期骨架数取结果条数的下界 3: 少猜一张，结果到达时更常见的是「多出来两张浮现」
 * 而不是「有一张凭空消失」——前者读作发现，后者读作出错。
 */
export const EXPLORE_PENDING_SLOTS = 3;

/** 结果上限，与 chat 的 DEFAULT_KEEP_LIMIT 同值；缩放按此预留以免结果到达时纸再缩一次 */
export const EXPLORE_SLOT_BUDGET = 5;

/** 等待期的假定亲疏阶梯；真值到达后各自就位 */
export const EXPLORE_PENDING_CLOSENESS = [0.92, 0.74, 0.56, 0.38] as const;

export type ExploreStageItem = { closeness: number; id: string };

export type ExploreStageInput = {
  items: readonly ExploreStageItem[];
  /** 纸张未变换的布局盒（视口坐标）；调用方以 offsetWidth/offsetHeight 取未变换尺寸 */
  paper: CordBox;
  viewport: { height: number; width: number };
};

export type ExploreStageSlot = {
  /** 连线两端，视口坐标；Cord 直接消费，无需再换算 */
  cordFrom: CordBox;
  cordTo: CordBox;
  /** 卡片中心到舞台中心的直线距离——这就是用户读到的「有多相关」 */
  distance: number;
  id: string;
  /** 错峰次序，0 是最相关的那张 */
  order: number;
  side: "left" | "right";
  /** 卡片中心，视口坐标 */
  x: number;
  y: number;
};

export type ExploreStagePlan = {
  card: { height: number; width: number };
  hub: { x: number; y: number };
  /** 卡片与其下方理由注文的间距与高度；CSS 与避让计算必须读同一份 */
  reason: { gap: number; height: number };
  /** 纸张退后变换；scale 之外只有横向平移，纵向靠 transform-origin 钉住当前阅读位置 */
  paper: { originX: number; originY: number; scale: number; translateX: number };
  slots: ExploreStageSlot[];
  /** 星野排不开（窄窗口）时为 false，调用方降级为静态清单 */
  viable: boolean;
};

const CARD_HEIGHT = 96;
const CARD_WIDTH = { max: 212, min: 184, ratio: 0.145 };
/**
 * 理由是卡片下方与之等宽的注文，占三行留量。
 *
 * 它本该写在连线上——那是最贴切的表达。但实测过: 一条能容纳 148px 理由的连线
 * 会把 1440 宽屏上的纸压到 424px（正文约 8px，已经不叫「保持可读」），而带舞台
 * 底色的标签压在纸的页边上又会像纸被挖了个洞。所以理由改为落在线的那一头、
 * 紧贴卡片之外: 横向预算分文不花，理由永远整段可读、永不是 tooltip，
 * 而卡片仍然只装笔记本身（标题与逐字引文），AI 的判断与笔记的原文因此不混在一个表面上。
 */
const REASON = { gap: 8, height: 52 };
/** 卡片与视口边缘的最小留白 */
const STAGE_MARGIN = 24;
/** 最近的卡片与纸边之间的呼吸；连线不再承载文字，故只需读得出「浮在纸周围」 */
const PAPER_GAP = 48;
/** 距离上限：再远就不像「围绕这张纸」而像两件无关的东西 */
const DISTANCE_CAP = 620;
/** 距离动态范围目标：低于此值「越近越相关」就读不出来了 */
const DESIRED_SPREAD = 120;
/** 低于此值判为排不开，降级静态清单 */
const MIN_SPREAD = 64;
/**
 * 缩放阶梯只到 0.52 就停: 再小纸上的字就不是「退后一步还看得见」而是一块灰色色块，
 * 而正文保持可读是探索态的前提。窗口窄到连 0.52 都排不开时，宁可降级成静态清单。
 */
const SCALE_STEPS = [
  0.78, 0.76, 0.74, 0.72, 0.70, 0.68, 0.66, 0.64, 0.62, 0.60,
  0.58, 0.56, 0.54, 0.52,
] as const;
/** 扇角从最宽开始试；纸越高越需要收窄，否则卡片会掉出视口 */
const AVOIDANCE_STEPS = [34, 41, 48, 55, 62] as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * 置信度 → 亲疏。真实置信度常挤在 0.75~0.95 这一小段，纯绝对映射会让五张卡几乎同一
 * 距离，距离这条唯一的信息通道就废了；纯名次映射又会让「一组都很像」和「一组都不像」
 * 长得一模一样。所以取两者的加权混合: 绝对值负责这一组整体离得多近，名次阶梯负责
 * 组内一定分得开——置信度并列时（模型很常给同一个数）仍然读得出先后。
 */
const ABSOLUTE_WEIGHT = 0.45;

export const exploreCloseness = (
  confidences: readonly number[],
): number[] => {
  const ranked = confidences
    .map((confidence, index) => ({ confidence, index }))
    .sort((left, right) =>
      right.confidence - left.confidence || left.index - right.index);
  const lastRank = Math.max(1, confidences.length - 1);
  const closeness = new Array<number>(confidences.length).fill(0);
  ranked.forEach((entry, rank) => {
    const ladder = 1 - rank / lastRank;
    closeness[entry.index] = clamp(
      entry.confidence * ABSOLUTE_WEIGHT + ladder * (1 - ABSOLUTE_WEIGHT),
      0,
      1,
    );
  });
  return closeness;
};

/** 等待期的伪候选，只为让骨架按最终尺度站位 */
export const explorePendingItems = (count: number): ExploreStageItem[] =>
  Array.from({ length: count }, (_, index) => ({
    closeness: EXPLORE_PENDING_CLOSENESS[index]
      ?? EXPLORE_PENDING_CLOSENESS[EXPLORE_PENDING_CLOSENESS.length - 1]!,
    id: `pending-${index}`,
  }));

/**
 * 候选 → 舞台条目。等待期不知道真实亲疏，用骨架阶梯先站位；
 * 生产 Hook 与 DEV 实验台共用这一步，实验台看到的排布才等于线上排布。
 */
export const exploreStageItems = (
  candidates: readonly { confidence: number; node_id: string }[],
  pending: boolean,
): ExploreStageItem[] => {
  if (pending) {
    return explorePendingItems(EXPLORE_PENDING_SLOTS);
  }
  const closeness = exploreCloseness(
    candidates.map((candidate) => candidate.confidence),
  );
  return candidates.map((candidate, index) => ({
    closeness: closeness[index]!,
    id: candidate.node_id,
  }));
};

const intersect = (box: CordBox, viewport: CordBox): CordBox => {
  const left = Math.max(box.x, viewport.x);
  const top = Math.max(box.y, viewport.y);
  const right = Math.min(box.x + box.width, viewport.x + viewport.width);
  const bottom = Math.min(box.y + box.height, viewport.y + viewport.height);
  return {
    height: Math.max(0, bottom - top),
    width: Math.max(0, right - left),
    x: left,
    y: top,
  };
};

const overlaps = (left: CordBox, right: CordBox, gap: number): boolean =>
  left.x < right.x + right.width + gap
  && right.x < left.x + left.width + gap
  && left.y < right.y + right.height + gap
  && right.y < left.y + left.height + gap;

/** 射线从中心矩形穿出的距离；与 Cord 共用同一个边缘求点，避免两套几何 */
const edgeDistance = (visible: CordBox, angle: number): number => {
  const edge = cordAnchor(
    {
      height: visible.height,
      width: visible.width,
      x: -visible.width / 2,
      y: -visible.height / 2,
    },
    { x: Math.cos(angle) * 1e6, y: Math.sin(angle) * 1e6 },
  );
  return Math.hypot(edge.x, edge.y);
};

/** 沿该方向到卡片仍完整留在视口内的最远中心距离 */
const reach = (
  hub: { x: number; y: number },
  angle: number,
  card: { height: number; width: number },
  viewport: { height: number; width: number },
): number => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const limits: number[] = [DISTANCE_CAP];
  if (cos > 0) {
    limits.push((viewport.width - STAGE_MARGIN - card.width / 2 - hub.x) / cos);
  } else if (cos < 0) {
    limits.push((STAGE_MARGIN + card.width / 2 - hub.x) / cos);
  }
  if (sin > 0) {
    limits.push((viewport.height - STAGE_MARGIN - card.height / 2 - hub.y) / sin);
  } else if (sin < 0) {
    limits.push((STAGE_MARGIN + card.height / 2 - hub.y) / sin);
  }
  return Math.max(0, Math.min(...limits));
};

type Stage = {
  hub: { x: number; y: number };
  paper: ExploreStagePlan["paper"];
  visible: CordBox;
};

/** 纸退后之后的实际占屏位置；hub 是它可见部分的中心，也是星野的圆心 */
const measureStage = (
  scale: number,
  paper: CordBox,
  viewport: { height: number; width: number },
): Stage => {
  const originX = paper.width / 2;
  // 纵向锚在「当前视口中心所对的那一段正文」上，于是长笔记缩小时读者看的地方不动
  const originY = clamp(viewport.height / 2 - paper.y, 0, paper.height);
  const translateX = viewport.width / 2 - (paper.x + paper.width / 2);
  const retreated: CordBox = {
    height: paper.height * scale,
    width: paper.width * scale,
    x: paper.x + originX - scale * originX + translateX,
    y: paper.y + originY - scale * originY,
  };
  const visible = intersect(retreated, {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  });
  return {
    hub: {
      x: visible.x + visible.width / 2,
      y: visible.y + visible.height / 2,
    },
    paper: { originX, originY, scale, translateX },
    visible,
  };
};

type Arrangement = {
  /** 全部卡片都在视口内、彼此不压、也不压纸 */
  ok: boolean;
  slots: ExploreStageSlot[];
  spread: number;
};

/**
 * radialLayout 定角度与分侧，这里把每条射线上的位置改成「到 hub 的直线距离」:
 * 最近距离取所有用到的角度里最保守的那条（保证最相关的那张也不压纸），
 * 最远距离取所有角度里最紧的那条（保证最不相关的那张也不出视口），
 * 于是同一次探索里所有卡片共享一根距离标尺，距离才真的可比。
 */
const arrange = (
  items: readonly ExploreStageItem[],
  stage: Stage,
  avoidance: number,
  card: { height: number; width: number },
  viewport: { height: number; width: number },
): Arrangement => {
  if (items.length === 0) {
    return { ok: true, slots: [], spread: 0 };
  }

  const placements = radialLayout(
    items.map((item) => ({ id: item.id, relevance: item.closeness })),
    {
      cardSize: card,
      centerSize: { height: stage.visible.height, width: stage.visible.width },
      // 半径参数在此只影响 radialLayout 内部的防重叠外推，其输出半径随后被距离标尺取代
      maxRadius: 320,
      minRadius: 120,
      verticalAvoidance: avoidance,
    },
  );

  let near = 0;
  let far = Number.POSITIVE_INFINITY;
  for (const placement of placements) {
    near = Math.max(
      near,
      edgeDistance(stage.visible, placement.angle) + card.width / 2 + PAPER_GAP,
    );
    far = Math.min(far, reach(stage.hub, placement.angle, card, viewport));
  }
  const spread = far - near;

  const slots = placements.map((placement, order): ExploreStageSlot => {
    const distance = lerp(near, far, 1 - clamp(placement.relevance, 0, 1));
    const x = stage.hub.x + Math.cos(placement.angle) * distance;
    const y = stage.hub.y + Math.sin(placement.angle) * distance;
    const cordTo: CordBox = {
      height: card.height,
      width: card.width,
      x: x - card.width / 2,
      y: y - card.height / 2,
    };
    return {
      cordFrom: stage.visible,
      cordTo,
      distance,
      id: placement.id,
      order,
      side: placement.side,
      x,
      y,
    };
  });

  // 卡片与其下方的理由注文是同一个不可分割的单元: 避让必须按整体算，
  // 否则理由会压到下一张卡或掉出视口——它和卡片一样是必须完整读到的东西。
  const unitOf = (slot: ExploreStageSlot): CordBox => ({
    height: card.height + REASON.gap + REASON.height,
    width: card.width,
    x: slot.cordTo.x,
    y: slot.cordTo.y,
  });

  let ok = spread > 0;
  slots.forEach((slot, index) => {
    const unit = unitOf(slot);
    if (
      unit.x < STAGE_MARGIN - 0.5
      || unit.y < STAGE_MARGIN - 0.5
      || unit.x + unit.width > viewport.width - STAGE_MARGIN + 0.5
      || unit.y + unit.height > viewport.height - STAGE_MARGIN + 0.5
      || overlaps(unit, stage.visible, 8)
    ) {
      ok = false;
    }
    for (const other of slots.slice(index + 1)) {
      if (overlaps(unit, unitOf(other), 12)) {
        ok = false;
      }
    }
  });

  return { ok, slots, spread };
};

type Geometry = { avoidance: number; stage: Stage };

/**
 * 求解「纸退多远、扇张多开」。偏好顺序是刻意的: 先要纸尽量大（正文仍要可读），
 * 再要扇尽量宽（观感），最后才退让到能排开为止。任何会把卡片挤出视口、压住纸或
 * 互相重叠的组合直接作废，而不是靠事后 clamp 掩盖。
 */
const findGeometry = (
  card: { height: number; width: number },
  paper: CordBox,
  viewport: { height: number; width: number },
): Geometry | null => {
  const budget = explorePendingItems(EXPLORE_SLOT_BUDGET);
  let best: { geometry: Geometry; spread: number } | null = null;

  for (const scale of SCALE_STEPS) {
    for (const avoidance of AVOIDANCE_STEPS) {
      const stage = measureStage(scale, paper, viewport);
      const probe = arrange(budget, stage, avoidance, card, viewport);
      if (!probe.ok) {
        continue;
      }
      if (probe.spread >= DESIRED_SPREAD) {
        return { avoidance, stage };
      }
      if (best === null || probe.spread > best.spread) {
        best = { geometry: { avoidance, stage }, spread: probe.spread };
      }
    }
  }

  return best?.geometry ?? null;
};

export const planExploreStage = (input: ExploreStageInput): ExploreStagePlan => {
  const card = {
    height: CARD_HEIGHT,
    width: Math.round(clamp(
      input.viewport.width * CARD_WIDTH.ratio,
      CARD_WIDTH.min,
      CARD_WIDTH.max,
    )),
  };
  const geometry = findGeometry(card, input.paper, input.viewport);

  if (geometry === null) {
    const fallback = measureStage(1, input.paper, input.viewport);
    return {
      card,
      hub: fallback.hub,
      paper: { ...fallback.paper, translateX: 0 },
      reason: REASON,
      slots: [],
      viable: false,
    };
  }

  const arrangement = arrange(
    input.items,
    geometry.stage,
    geometry.avoidance,
    card,
    input.viewport,
  );

  return {
    card,
    hub: geometry.stage.hub,
    paper: geometry.stage.paper,
    reason: REASON,
    slots: arrangement.slots,
    viable: arrangement.ok
      && (input.items.length === 0 || arrangement.spread >= MIN_SPREAD),
  };
};

/**
 * 是否呈现径向星野。两个否决条件都不是「降级」而是「换一种正确表达」:
 * reduced-motion 下位移与路径绘制本身就被禁止，窗口窄到距离读不出来时
 * 距离这条唯一的信息通道已经失效——两种情况都改用静态清单，而不是硬排。
 */
export const shouldRenderExploreStars = ({
  plan,
  reducedMotion,
}: {
  plan: ExploreStagePlan | null;
  reducedMotion: boolean;
}): boolean => !reducedMotion && plan !== null && plan.viable;

/** 卡片位移的错峰延迟 */
export const exploreGlideDelayMs = (order: number): number =>
  order * EXPLORE_STAGE_MOTION.glideStaggerMs;

/** 骨架变实的错峰延迟 */
export const exploreMaterializeDelayMs = (order: number): number =>
  EXPLORE_STAGE_MOTION.materializeStartMs
    + order * EXPLORE_STAGE_MOTION.materializeStaggerMs;
