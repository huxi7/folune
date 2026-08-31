/**
 * [INPUT]: 依赖 Bun test、react-dom/server 与真实 CanvasStageLoading
 * [OUTPUT]: 锁定隐藏状态不挂载任何全屏覆盖层，显示状态只渲染一张纸面 Skeleton
 * [POS]: widgets 的 Canvas 首屏占位回归门禁；防止透明 Skeleton 容器继续遮住已经 ready 的 React Flow
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasStageLoading } from "./CanvasStageLoading";

describe("CanvasStageLoading", () => {
  test("不可见时完全卸载，不留下覆盖 Canvas 的容器", () => {
    expect(renderToStaticMarkup(<CanvasStageLoading visible={false} />)).toBe("");
  });

  test("可见时只有一张真实纸面比例 Skeleton", () => {
    const html = renderToStaticMarkup(<CanvasStageLoading visible />);

    expect(html).toContain("canvas-stage-loading");
    expect(html.match(/canvas-stage-loading-paper/g)).toHaveLength(1);
  });
});
