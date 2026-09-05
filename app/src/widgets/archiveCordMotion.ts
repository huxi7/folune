/**
 * [INPUT]: 无外部依赖；只持有本次会话内 Archive Cord 的运动租约集合
 * [OUTPUT]: 对外提供 beginArchiveMotion/endArchiveMotion/isArchiveMotionActive/subscribeArchiveMotion 四个动作
 * [POS]: widgets 的归档线运动租约总线；tree FLIP 与 Panel Tween 在此声明「我正在动」，唯一的几何调度器（ArchiveCordOverlay）据此决定要不要逐帧重读布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/*
 * 为什么需要租约而不是继续听 transitionend / ResizeObserver：
 *
 * Panel 用 Motion 的 x/opacity Tween 移动，那是纯 transform —— ResizeObserver 看不见它，
 * transitionend 也不会来（Motion 走的是 WAAPI/rAF 而不是 CSS transition）。树行的 FLIP
 * 同理。于是「结束了没有」这件事只能由发起运动的那一方说，猜不出来。
 *
 * 租约按来源计数：同一来源可以重入（连续折叠两次），不同来源互不干扰；全部归零才允许
 * 调度器停下。静止的页面因此没有常驻测量循环 —— 不动就不读布局，比优化一个永远在跑的
 * 循环更正确。
 */
const leases = new Map<string, number>();
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const beginArchiveMotion = (source: string): void => {
  leases.set(source, (leases.get(source) ?? 0) + 1);
  notify();
};

export const endArchiveMotion = (source: string): void => {
  const count = leases.get(source) ?? 0;
  if (count <= 1) leases.delete(source);
  else leases.set(source, count - 1);
  notify();
};

export const isArchiveMotionActive = (): boolean => leases.size > 0;

export const subscribeArchiveMotion = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
