/**
 * [INPUT]: 依赖 Bun test 与助手纯几何策略
 * [OUTPUT]: 锁定默认短窗即最小尺寸、八方向对边固定/旧偏好恢复边界，以及屏幕变化和键盘出现时的完整可达性
 * [POS]: widgets 的助手空间约束门禁；浏览器动效观感另由真实页面验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { constrainAssistantRect, resizeAssistantRect, resolveAssistantGeometry, type AssistantResizeEdge } from "./assistantGeometry";

test("短/全高同宽同底边，全高对齐Panel，短窗不超过2/3", () => {
  const input = { viewportWidth: 1440, viewportHeight: 900, panelWidth: 360 };
  const compact = resolveAssistantGeometry({ ...input, size: "compact" });
  const expanded = resolveAssistantGeometry({ ...input, size: "expanded" });
  expect(compact.width).toBe(expanded.width);
  expect(compact.bottom).toBe(expanded.bottom);
  expect(expanded.height + expanded.bottom).toBe(884);
  expect(compact.height).toBe(520);
  expect(compact.height).toBeLessThanOrEqual(expanded.height * 2 / 3 + 1);
});

test("四边四角调整保留对边，边角同时改变宽高", () => {
  const bounds = { left: 16, top: 16, right: 1424, bottom: 884 };
  const rect = { left: 600, top: 200, width: 360, height: 600 };
  expect(resizeAssistantRect(rect, "nw", -160, -120, bounds)).toEqual({ left: 440, top: 80, width: 520, height: 720 });
  expect(resizeAssistantRect(rect, "se", 80, 80, bounds)).toEqual({ left: 600, top: 200, width: 440, height: 680 });
  expect(resizeAssistantRect(rect, "n", 90, 100, bounds)).toEqual({ left: 600, top: 280, width: 360, height: 520 });
  expect(resizeAssistantRect(rect, "e", 80, 90, bounds)).toEqual({ left: 600, top: 200, width: 440, height: 600 });
});

test("每个方向都不能穿过视口或压扁输入区，屏幕变小时自定义窗口仍可到达", () => {
  const bounds = { left: 12, top: 12, right: 788, bottom: 688 };
  const rect = { left: 300, top: 100, width: 360, height: 500 };
  for (const edge of ["n", "s", "e", "w", "nw", "ne", "sw", "se"] as AssistantResizeEdge[]) {
    for (const delta of [-10000, 10000]) {
      const next = resizeAssistantRect(rect, edge, delta, delta, bounds);
      expect(next.width).toBeGreaterThanOrEqual(360);
      expect(next.height).toBeGreaterThanOrEqual(451);
      expect(next.left).toBeGreaterThanOrEqual(bounds.left);
      expect(next.top).toBeGreaterThanOrEqual(bounds.top);
      expect(next.left + next.width).toBeLessThanOrEqual(bounds.right);
      expect(next.top + next.height).toBeLessThanOrEqual(bounds.bottom);
    }
  }
  const small = constrainAssistantRect(rect, { left: 12, top: 12, right: 228, bottom: 240 });
  expect(small).toEqual({ left: 12, top: 12, width: 216, height: 228 });
  expect(resizeAssistantRect(rect, "se", 500, 500, { left: 12, top: 12, right: 228, bottom: 240 })).toEqual(small);
  const restored = resolveAssistantGeometry({ viewportWidth: 800, viewportHeight: 700, panelWidth: 500, size: "compact", frame: { height: 1000, right: 1000, bottom: 1000 } });
  expect(restored.height).toBe(676);
  expect(restored.right + restored.width).toBeLessThanOrEqual(788);
  expect(restored.bottom).toBe(12);
});

test("旧的过小偏好恢复到默认短窗，八方向缩小时停在同一尺寸", () => {
  const input = { viewportWidth: 1440, viewportHeight: 900, panelWidth: 264 };
  const minimum = resolveAssistantGeometry({ ...input, size: "compact" });
  expect(minimum.width).toBe(360);
  expect(minimum.height).toBe(520);
  const restored = resolveAssistantGeometry({ ...input, size: "compact", frame: { height: 280, right: 16, bottom: 16 } });
  expect(restored).toEqual(minimum);
  const bounds = { left: 16, top: 16, right: 1424, bottom: 884 };
  const start = { left: 400, top: 100, width: 700, height: 700 };
  for (const edge of ["n", "s", "e", "w", "nw", "ne", "sw", "se"] as AssistantResizeEdge[]) {
    const next = resizeAssistantRect(start, edge, edge.includes("w") ? 10000 : -10000, edge.includes("n") ? 10000 : -10000, bounds);
    expect(next.width).toBe(edge.includes("w") || edge.includes("e") ? minimum.width : start.width);
    expect(next.height).toBe(edge.includes("n") || edge.includes("s") ? minimum.height : start.height);
  }
});
test("手机键盘出现后窗口完整落在可视区域，低矮屏仍能使用Composer", () => {
  const window = resolveAssistantGeometry({ viewportWidth: 375, viewportHeight: 812, availableHeight: 340, offsetTop: 0, panelWidth: 440, size: "compact" });
  expect(window.width).toBe(351);
  expect(window.bottom).toBe(484);
  expect(window.height).toBe(316);
  expect(812 - window.bottom - window.height).toBe(12);
});
