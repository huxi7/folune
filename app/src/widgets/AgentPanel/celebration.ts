/**
 * [INPUT]: 依赖 canvas-confetti 的独立 Canvas/Web Worker 粒子渲染与 index.css 的庆祝色板语义 token
 * [OUTPUT]: 对外提供 playCelebration，在全屏非交互画布播放约 2.8 秒礼花并返回可交给 Agent 的完成结果
 * [POS]: AgentPanel 的浏览器工具执行器；只负责庆祝视觉生命周期，不承载 AI SDK 消息状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type confetti from "canvas-confetti";

const CELEBRATION_DURATION_MS = 2_800;
const EMISSION_DURATION_MS = 2_150;
const BURST_INTERVAL_MS = 90;
const CELEBRATION_COLOR_TOKENS = [
  "--celebration-confetti-1",
  "--celebration-confetti-2",
  "--celebration-confetti-3",
  "--celebration-confetti-4",
  "--celebration-confetti-5",
] as const;

export type CelebrationResult = {
  durationMs: number;
  particleCount: number;
  reducedMotion: boolean;
  success: true;
};

let activeCelebration: Promise<CelebrationResult> | null = null;

function getCelebrationColors() {
  const styles = getComputedStyle(document.documentElement);
  const colors = CELEBRATION_COLOR_TOKENS
    .map((token) => styles.getPropertyValue(token).trim())
    .filter(Boolean);

  if (colors.length !== CELEBRATION_COLOR_TOKENS.length) {
    throw new Error("庆祝动画缺少完整的主题色配置。");
  }

  return colors;
}

async function runCelebration(): Promise<CelebrationResult> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return {
      durationMs: 0,
      particleCount: 0,
      reducedMotion: true,
      success: true,
    };
  }

  const [{ default: confetti }, colors] = await Promise.all([
    import("canvas-confetti"),
    Promise.resolve(getCelebrationColors()),
  ]);
  const canvas = document.createElement("canvas");
  canvas.dataset.supernoteCelebration = "true";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    height: "100%",
    inset: "0",
    pointerEvents: "none",
    position: "fixed",
    width: "100%",
    zIndex: "2147483646",
  });
  document.body.append(canvas);

  const fire = confetti.create(canvas, {
    disableForReducedMotion: true,
    resize: true,
    useWorker: true,
  });
  const startedAt = performance.now();
  let animationFrame = 0;
  let lastBurstAt = Number.NEGATIVE_INFINITY;
  let particleCount = 0;

  const launch = (options: confetti.Options) => {
    particleCount += options.particleCount ?? 0;
    void fire({
      colors,
      disableForReducedMotion: true,
      shapes: ["square", "circle", "star"],
      zIndex: 2_147_483_646,
      ...options,
    });
  };

  launch({
    origin: { x: 0.5, y: 0.72 },
    particleCount: 72,
    scalar: 0.92,
    spread: 104,
    startVelocity: 48,
    ticks: 112,
  });

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      cancelAnimationFrame(animationFrame);
      fire.reset();
      canvas.remove();
      resolve({
        durationMs: Math.round(performance.now() - startedAt),
        particleCount,
        reducedMotion: false,
        success: true,
      });
    };
    window.setTimeout(finish, CELEBRATION_DURATION_MS);

    const frame = (now: number) => {
      const elapsed = now - startedAt;

      if (elapsed >= EMISSION_DURATION_MS) {
        return;
      }

      if (now - lastBurstAt >= BURST_INTERVAL_MS) {
        lastBurstAt = now;
        launch({
          angle: 58,
          origin: { x: 0.02, y: 0.76 },
          particleCount: 6,
          scalar: 0.82,
          spread: 58,
          startVelocity: 43,
          ticks: 104,
        });
        launch({
          angle: 122,
          origin: { x: 0.98, y: 0.76 },
          particleCount: 6,
          scalar: 0.82,
          spread: 58,
          startVelocity: 43,
          ticks: 104,
        });

        if (Math.floor(elapsed / BURST_INTERVAL_MS) % 4 === 0) {
          launch({
            origin: { x: 0.2 + Math.random() * 0.6, y: 0.42 + Math.random() * 0.24 },
            particleCount: 10,
            scalar: 0.72,
            spread: 92,
            startVelocity: 26,
            ticks: 86,
          });
        }
      }

      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
  });
}

export function playCelebration() {
  if (activeCelebration) {
    return activeCelebration;
  }

  const celebration = runCelebration().finally(() => {
    if (activeCelebration === celebration) {
      activeCelebration = null;
    }
  });
  activeCelebration = celebration;

  return celebration;
}
