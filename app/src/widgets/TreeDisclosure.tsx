/**
 * [INPUT]: 依赖 DS Collapse 与归档线运动租约
 * [OUTPUT]: 对外提供树子级连续开合，动画期间归档线重读真实节点几何
 * [POS]: 文件树与归档 Overlay 的薄适配层；可中断动画和卸载共用幂等 release，不把领域依赖塞进 DS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useRef, type ReactNode } from "react";
import { Collapse } from "../shared/design-system/components/Collapse";
import { beginArchiveMotion, endArchiveMotion } from "./archiveCordMotion";
export function TreeDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  const leased = useRef(false);
  const start = useCallback(() => {
    if (leased.current) return;
    leased.current = true;
    beginArchiveMotion("tree-disclosure");
  }, []);
  const end = useCallback(() => {
    if (!leased.current) return;
    leased.current = false;
    endArchiveMotion("tree-disclosure");
  }, []);
  return <Collapse className="memo-tree-children" open={open} onMotionStart={start} onMotionEnd={end}>{children}</Collapse>;
}
