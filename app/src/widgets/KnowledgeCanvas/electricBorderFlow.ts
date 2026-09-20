/**
 * [INPUT]: ElectricBorder 顺时针周长进度、本地宽高/圆角、已乘 speed 的时间及噪声位移
 * [OUTPUT]: 右下发起/左上收束的采样坐标与端点衰减，以及保留微小纹理的二维位移软上限
 * [POS]: 上游 ElectricBorder 的几何适配；方向与位移边界在此约束，原始噪声、Chaos 与速度乘数仍归组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function limitElectricBorderOffset(x: number, y: number, maximum: number) {
  if (maximum <= 0) return { x: 0, y: 0 };
  const magnitude = Math.hypot(x, y);
  const knee = maximum / 2;
  if (!Number.isFinite(maximum) || magnitude <= knee) return { x, y };
  // 小毛边不变，过半后连续收紧；按向量长度限幅，斜向尖刺也不能越过上限。
  const bounded = knee + knee * Math.tanh((magnitude - knee) / knee);
  const ratio = bounded / magnitude;
  return { x: x * ratio, y: y * ratio };
}

export function electricBorderFlow(
  progress: number,
  width: number,
  height: number,
  radius: number,
  time: number,
) {
  const horizontal = width - 2 * radius;
  const vertical = height - 2 * radius;
  const arc = Math.PI * radius / 2;
  const perimeter = 2 * (horizontal + vertical) + 4 * arc;
  if (perimeter <= 0) return { position: 0, envelope: 0 };
  // 上游轮廓从左上圆角后的顶边起步；右下角中点与左上角中点相隔半周长。
  const source = horizontal + vertical + 1.5 * arc;
  const clockwise = ((progress * perimeter - source) % perimeter + perimeter) % perimeter;
  const distance = Math.min(clockwise, perimeter - clockwise);
  const halfPerimeter = perimeter / 2;
  const fade = Math.min(1, distance / radius, (halfPerimeter - distance) / radius);
  const envelope = radius > 0 ? fade * fade * (3 - 2 * fade) : 1;
  return {
    // 同一纹理只向距离增大的方向传播。0.3 沿用上游的时间频率系数，无第二套速度。
    position: distance / halfPerimeter * 8 - time * 0.3,
    envelope,
  };
}
