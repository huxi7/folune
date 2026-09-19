/**
 * [INPUT]: 依赖本目录中的 React Bits Waves 与 Aceternity Background Beams 实际组件源码
 * [OUTPUT]: 对外提供 E/F 背景装配和对应渲染状态
 * [POS]: 已淘汰 E/F 的历史适配层，不再被当前 Lab 导入；仅保留源码及许可追溯
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef } from "react";
import Waves from "./ReactBitsWaves";
import { BackgroundBeams } from "./AceternityBeams";
import type { ShaderStatus } from "./HeroArtwork";

export function LibraryArtwork({ concept, running, onStatus }: {
  concept: "waves" | "beams";
  running: boolean;
  onStatus: (status: ShaderStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    onStatus(concept === "beams" || canvas?.getContext("2d") ? "ready" : "unavailable");
  }, [concept, onStatus]);
  return <div ref={host} className={`hero-lab-art hero-lab-art-${concept}`} aria-hidden="true">
    {concept === "waves" ? <Waves running={running} lineColor="#64859a85" backgroundColor="#f4f4f2" waveSpeedX={0.022} waveSpeedY={0.012} waveAmpX={26} waveAmpY={14} xGap={22} yGap={10} maxCursorMove={0} /> : <BackgroundBeams running={running} />}
    <div className="hero-lab-reading-veil" />
  </div>;
}
