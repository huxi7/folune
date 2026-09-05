/**
 * [INPUT]: 读取 KnowledgeCanvas 的响应式 viewport 校准 effect
 * [OUTPUT]: 锁定窗口/Canvas 容器尺寸变化会用 latest nodes 检查可见性并 fitView，observer 不随节点拖动重建，且不会把响应式修复写回持久 viewport
 * [POS]: KnowledgeCanvas 视口回归门禁；补足纯投影测试无法证明的响应式生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "KnowledgeCanvas.tsx"), "utf8");

describe("Canvas viewport resize", () => {
  test("resize/ResizeObserver 检查节点是否离开视口并只做 UI fit", () => {
    expect(source).toContain("fitIfNodesLeaveViewport");
    expect(source).toContain('window.addEventListener("resize", fitIfNodesLeaveViewport)');
    expect(source).toContain("observer.observe(flowRef.current)");
    expect(source).toContain("canvasViewportShowsNodes(");
    expect(source).toContain("void instance.fitView({ duration: 0, padding: 0.18 });");
    expect(source).toContain("const viewport = instance.getViewport();");
    expect(source).toContain("canvasNodesBounds(latestFlowNodesRef.current)");
    expect(source).toContain("}, [hasFlowNodes]);");
    expect(source).not.toContain("setViewportSize");
  });
});
