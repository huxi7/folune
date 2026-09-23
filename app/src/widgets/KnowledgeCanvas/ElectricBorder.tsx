/**
 * [INPUT]: React Bits ElectricBorder 原始 color/speed/chaos/borderRadius 与 React Canvas、electricBorderFrames 共享帧调度；增加线宽、暂停、平滑圆角、方向映射及 maxDisplacement 位移上限
 * [OUTPUT]: 对外提供 ElectricBorder；上游噪声持续演化且按 flow 定向传播，描边前以 maxDisplacement 平滑约束局部尖刺
 * [POS]: Canvas 按住反馈使用的上游组件副本；方向只映射采样坐标，不重写波形/速度乘数/Chaos；另适配 Flow 本地尺寸、DS 曲率/颜色；同规格共享单一帧循环与栅格，位移上限收紧透明缓冲区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 * 来源：https://github.com/DavidHDev/react-bits/blob/eae800a74f6455ba5afaedc4cdd8700e5a159c33/src/ts-default/Animations/ElectricBorder/ElectricBorder.tsx
 * Copyright (c) 2026 David Haz；许可见 ElectricBorder.LICENSE.md。
 */

import React, { useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from 'react';
import { electricBorderFlow, limitElectricBorderOffset } from './electricBorderFlow';
import './ElectricBorder.css';
import { subscribeElectricBorderFrame } from './electricBorderFrames';

interface ElectricBorderProps {
  children?: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
  thickness?: number;
  maxDisplacement?: number;
  paused?: boolean;
  squircle?: boolean;
  flow?: 'bottom-right-to-top-left';
  className?: string;
  style?: CSSProperties;
}

const ElectricBorder: React.FC<ElectricBorderProps> = ({
  children,
  color = '#5227FF',
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  thickness = 1,
  maxDisplacement = Infinity,
  paused = false,
  squircle = false,
  flow,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const random = useCallback((x: number): number => {
    return (Math.sin(x * 12.9898) * 43758.5453) % 1;
  }, []);

  const noise2D = useCallback(
    (x: number, y: number): number => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;

      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);

      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uy = fy * fy * (3.0 - 2.0 * fy);

      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    },
    [random]
  );

  const octavedNoise = useCallback(
    (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      time: number,
      seed: number,
      baseFlatness: number
    ): number => {
      let y = 0;
      let amplitude = baseAmplitude;
      let frequency = baseFrequency;

      for (let i = 0; i < octaves; i++) {
        let octaveAmplitude = amplitude;
        if (i === 0) {
          octaveAmplitude *= baseFlatness;
        }
        y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amplitude *= gain;
      }

      return y;
    },
    [noise2D]
  );

  const getCornerPoint = useCallback(
    (
      centerX: number,
      centerY: number,
      radius: number,
      startAngle: number,
      arcLength: number,
      progress: number
    ): { x: number; y: number } => {
      const angle = startAngle + progress * arcLength;
      // 波形仍由上游噪声决定；只让无位移轮廓匹配项目的 CSS squircle。
      const power = squircle ? 0.5 : 1;
      return {
        x: centerX + radius * Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** power,
        y: centerY + radius * Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** power
      };
    },
    [squircle]
  );

  const getRoundedRectPoint = useCallback(
    (t: number, left: number, top: number, width: number, height: number, radius: number): { x: number; y: number } => {
      const straightWidth = width - 2 * radius;
      const straightHeight = height - 2 * radius;
      const cornerArc = (Math.PI * radius) / 2;
      const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
      const distance = t * totalPerimeter;

      let accumulated = 0;

      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + radius + progress * straightWidth, y: top };
      }
      accumulated += straightWidth;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left + width, y: top + radius + progress * straightHeight };
      }
      accumulated += straightHeight;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + width - radius - progress * straightWidth, y: top + height };
      }
      accumulated += straightWidth;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left, y: top + height - radius - progress * straightHeight };
      }
      accumulated += straightHeight;

      const progress = (distance - accumulated) / cornerArc;
      return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, progress);
    },
    [getCornerPoint]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const octaves = 10;
    const lacunarity = 1.6;
    const gain = 0.7;
    const amplitude = chaos;
    const frequency = 10;
    const baseFlatness = 0;
    const displacement = 60;
    // 位移有界时只分配真实描边外溢面积，避免每张卡片清空大块透明像素。
    const borderOffset = Number.isFinite(maxDisplacement)
      ? Math.ceil(Math.max(0, maxDisplacement) + thickness / 2 + 1) : 60;

    let visible = true;
    let strokeColor = color;
    const updateSize = () => {
      // Flow 已经缩放父层，这里只能读未变换的布局尺寸，避免二次缩放。
      const width = container.offsetWidth + borderOffset * 2;
      const height = container.offsetHeight + borderOffset * 2;
      strokeColor = color === 'currentColor'
        ? container.ownerDocument.defaultView!.getComputedStyle(container).color : color;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      return { width, height };
    };

    let { width, height } = updateSize();
    let lastDpr = Math.min(window.devicePixelRatio || 1, 2);

    const drawElectricBorder = (currentTime: number) => {
      if (!canvas || !ctx) return;

      const dpr = lastDpr;

      const time = paused ? 0 : currentTime / 1000 * speed;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const scale = displacement;
      const left = borderOffset;
      const top = borderOffset;
      const borderWidth = width - 2 * borderOffset;
      const borderHeight = height - 2 * borderOffset;
      const maxRadius = Math.min(borderWidth, borderHeight) / 2;
      const radius = Math.min(borderRadius, maxRadius);

      const approximatePerimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius;
      const sampleCount = Math.floor(approximatePerimeter / 2);

      ctx.beginPath();

      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount;

        const point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius);
        const directed = flow === 'bottom-right-to-top-left'
          ? electricBorderFlow(progress, borderWidth, borderHeight, radius, time)
          : null;
        const noisePosition = directed?.position ?? progress * 8;
        // flow 只决定纹理往哪里走；二维噪声的时间轴必须同时推进，否则只是冻结纹理平移。
        const noiseTime = time;

        const xNoise = octavedNoise(
          noisePosition,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          noiseTime,
          0,
          baseFlatness
        );
        const yNoise = octavedNoise(
          noisePosition,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          noiseTime,
          1,
          baseFlatness
        );

        const envelope = directed?.envelope ?? 1;
        const offset = limitElectricBorderOffset(
          xNoise * scale * envelope,
          yNoise * scale * envelope,
          maxDisplacement,
        );
        const displacedX = point.x + offset.x;
        const displacedY = point.y + offset.y;

        if (i === 0) {
          ctx.moveTo(displacedX, displacedY);
        } else {
          ctx.lineTo(displacedX, displacedY);
        }
      }

      ctx.closePath();
      ctx.stroke();
    };

    let unsubscribe: (() => void) | null = null;
    const syncAnimation = () => {
      unsubscribe?.();
      unsubscribe = null;
      if (!visible || document.hidden) return;
      const key = JSON.stringify([
        width, height, lastDpr, strokeColor, speed, chaos, borderRadius,
        thickness, maxDisplacement, squircle, flow,
      ]);
      unsubscribe = subscribeElectricBorderFrame(key, {
        canvas, context: ctx, draw: drawElectricBorder,
      }, !paused);
    };
    const resize = () => {
      const newSize = updateSize();
      width = newSize.width;
      height = newSize.height;
      lastDpr = Math.min(window.devicePixelRatio || 1, 2);
      syncAnimation();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener('resize', resize);
    const intersection = typeof IntersectionObserver === 'undefined' ? null
      : new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
        syncAnimation();
      });
    intersection?.observe(container);
    document.addEventListener('visibilitychange', syncAnimation);
    syncAnimation();

    return () => {
      unsubscribe?.();
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      intersection?.disconnect();
      document.removeEventListener('visibilitychange', syncAnimation);
    };
  }, [color, speed, chaos, borderRadius, thickness, maxDisplacement, paused, flow, squircle, octavedNoise, getRoundedRectPoint]);

  const vars = {
    '--electric-border-color': color,
    borderRadius
  } as CSSProperties;

  return (
    <div ref={containerRef} className={`electric-border ${className ?? ''}`} style={{ ...vars, ...style }}>
      <div className="eb-canvas-container">
        <canvas ref={canvasRef} className="eb-canvas" />
      </div>
      <div className="eb-layers">
        <div className="eb-glow-1" />
        <div className="eb-glow-2" />
        <div className="eb-background-glow" />
      </div>
      <div className="eb-content">{children}</div>
    </div>
  );
};

export default ElectricBorder;
