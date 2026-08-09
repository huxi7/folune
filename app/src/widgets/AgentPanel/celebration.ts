/**
 * [INPUT]: 依赖 canvas-confetti 托管的唯一全屏 Canvas、可用时的内部渲染 Worker 与 index.css 的庆祝色板语义 token
 * [OUTPUT]: 对外提供 createCelebrationPlan、createCelebrationBursts、playCelebration 与 cancelCelebration，把用户要求的次数编排为从底边集中升起、短间隔连续扩散的三源礼花并支持即时停止
 * [POS]: AgentPanel 的独立视觉工具执行器；不经过 memoTool Worker，只负责次数归一、窄锥对称构图、无停顿点射与可取消串行生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type confetti from "canvas-confetti";

const CELEBRATION_MAX_DURATION_MS = 3_000;
const MAX_RELEASE_WINDOW_MS = 400;
const MAX_WAVE_GAP_MS = 32;
const MAX_RENDERED_WAVES = 32;
const PARTICLE_BUDGET = 720;
const EDGE_START_VELOCITY = 62;
const CENTER_START_VELOCITY = 68;
const CELEBRATION_DECAY = 0.92;
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
  renderedWaves: number;
  requestedCount: number;
  success: true;
};

export type CelebrationPlan = {
  particlesPerWave: number;
  renderedWaves: number;
  requestedCount: number;
  waveGapMs: number;
};

export type CelebrationBurst = {
  angle: number;
  drift: number;
  origin: { x: number; y: number };
  particleCount: number;
  scalar: number;
  spread: number;
  startVelocity: number;
};

let celebrationQueue: Promise<void> = Promise.resolve();
let celebrationGeneration = 0;
let activeCelebrationCancel: (() => void) | null = null;

const createCelebrationAbortError = () => {
  const error = new Error("庆祝已停止。");
  error.name = "AbortError";
  return error;
};

export function createCelebrationPlan(count: unknown): CelebrationPlan {
  const requestedCount = typeof count === "number"
    && Number.isSafeInteger(count)
    && count > 0
    ? count
    : 1;
  const renderedWaves = Math.min(requestedCount, MAX_RENDERED_WAVES);
  const waveGapMs = renderedWaves === 1
    ? 0
    : Math.min(
        MAX_WAVE_GAP_MS,
        MAX_RELEASE_WINDOW_MS / (renderedWaves - 1),
      );

  return {
    particlesPerWave: Math.max(
      10,
      Math.min(180, Math.floor(PARTICLE_BUDGET / renderedWaves)),
    ),
    renderedWaves,
    requestedCount,
    waveGapMs,
  };
}

export function createCelebrationBursts(
  particlesPerWave: number,
): [CelebrationBurst, CelebrationBurst, CelebrationBurst] {
  const edgeParticles = Math.max(1, Math.floor(particlesPerWave * 0.28));
  const centerParticles = particlesPerWave - edgeParticles * 2;

  return [
    {
      angle: 66,
      drift: 0.025,
      origin: { x: 0.02, y: 1.04 },
      particleCount: edgeParticles,
      scalar: 0.9,
      spread: 38,
      startVelocity: EDGE_START_VELOCITY,
    },
    {
      angle: 90,
      drift: 0,
      origin: { x: 0.5, y: 1.04 },
      particleCount: centerParticles,
      scalar: 0.96,
      spread: 52,
      startVelocity: CENTER_START_VELOCITY,
    },
    {
      angle: 114,
      drift: -0.025,
      origin: { x: 0.98, y: 1.04 },
      particleCount: edgeParticles,
      scalar: 0.9,
      spread: 38,
      startVelocity: EDGE_START_VELOCITY,
    },
  ];
}

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

async function runCelebration(
  count: unknown,
  generation: number,
): Promise<CelebrationResult> {
  const plan = createCelebrationPlan(count);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return {
      durationMs: 0,
      particleCount: 0,
      reducedMotion: true,
      renderedWaves: 0,
      requestedCount: plan.requestedCount,
      success: true,
    };
  }

  const [{ default: confetti }, colors] = await Promise.all([
    import("canvas-confetti"),
    Promise.resolve(getCelebrationColors()),
  ]);
  if (generation !== celebrationGeneration) {
    throw createCelebrationAbortError();
  }

  const startedAt = performance.now();
  let particleCount = 0;

  return new Promise((resolve, reject) => {
    const scheduledWaves: number[] = [];
    let finished = false;
    let cancel: () => void = () => undefined;

    const finish = (error?: unknown) => {
      if (finished) {
        return;
      }

      finished = true;
      scheduledWaves.forEach(window.clearTimeout);
      window.clearTimeout(watchdog);
      if (activeCelebrationCancel === cancel) {
        activeCelebrationCancel = null;
      }

      if (error !== undefined) {
        confetti.reset();
        reject(error);
        return;
      }

      resolve({
        durationMs: Math.round(performance.now() - startedAt),
        particleCount,
        reducedMotion: false,
        renderedWaves: plan.renderedWaves,
        requestedCount: plan.requestedCount,
        success: true,
      });
    };
    const watchdog = window.setTimeout(() => {
      confetti.reset();
      finish();
    }, CELEBRATION_MAX_DURATION_MS);
    cancel = () => finish(createCelebrationAbortError());
    activeCelebrationCancel = cancel;

    try {
      const [leftBurst, centerBurst, rightBurst] =
        createCelebrationBursts(plan.particlesPerWave);
      for (let waveIndex = 0; waveIndex < plan.renderedWaves; waveIndex += 1) {
        scheduledWaves.push(window.setTimeout(() => {
          if (finished) {
            return;
          }

          try {
            const common: confetti.Options = {
              colors,
              decay: CELEBRATION_DECAY,
              disableForReducedMotion: true,
              gravity: 1.02,
              shapes: ["square", "circle", "star"],
              ticks: 140,
              zIndex: 2_147_483_646,
            };
            confetti({ ...common, ...leftBurst });
            confetti({ ...common, ...rightBurst });
            const animation = confetti({ ...common, ...centerBurst });
            particleCount += plan.particlesPerWave;

            if (waveIndex === plan.renderedWaves - 1) {
              Promise.resolve(animation).then(
                () => finish(),
                (error) => finish(error),
              );
            }
          } catch (error) {
            finish(error);
          }
        }, Math.round(waveIndex * plan.waveGapMs)));
      }
    } catch (error) {
      finish(error);
    }
  });
}

export function playCelebration(count: unknown = 1) {
  const generation = celebrationGeneration;
  const celebration = celebrationQueue.catch(() => undefined).then(() => {
    if (generation !== celebrationGeneration) {
      throw createCelebrationAbortError();
    }

    return runCelebration(count, generation);
  });
  celebrationQueue = celebration.then(
    () => undefined,
    () => undefined,
  );

  return celebration;
}

export function cancelCelebration() {
  celebrationGeneration += 1;
  const cancel = activeCelebrationCancel;
  celebrationQueue = Promise.resolve();
  cancel?.();
}
