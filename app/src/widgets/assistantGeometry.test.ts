/**
 * [INPUT]: 依赖 Bun test 与助手纯几何策略
 * [OUTPUT]: 锁定5:8默认阅读窗与独立拖动下限、八方向对边固定/临时浮窗边界，以及屏幕变化和键盘出现时的完整可达性；Demo面板宽度不受真实窗口下限影响
 * [POS]: widgets 的助手空间约束门禁；浏览器动效观感另由真实页面验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { ASSISTANT_DEFAULT_WIDTH, constrainAssistantRect, resizeAssistantRect, resolveAssistantGeometry, type AssistantResizeEdge } from "./assistantGeometry";

test("400×640默认短窗为5:8，全高同宽同底边并对齐Panel", () => {
  const input = { viewportWidth: 1440, viewportHeight: 900, panelWidth: ASSISTANT_DEFAULT_WIDTH };
  const compact = resolveAssistantGeometry({ ...input, size: "compact" });
  const expanded = resolveAssistantGeometry({ ...input, size: "expanded" });
  expect(compact.width).toBe(expanded.width);
  expect(compact.bottom).toBe(expanded.bottom);
  expect(expanded.height + expanded.bottom).toBe(884);
  expect(compact.width).toBe(400);
  expect(compact.height).toBe(640);
  expect(compact.width / compact.height).toBe(5 / 8);
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
  const restored = resolveAssistantGeometry({ viewportWidth: 800, viewportHeight: 700, panelWidth: 500, size: "compact", frame: { width: 500, height: 1000, right: 1000, bottom: 1000 } });
  expect(restored.height).toBe(676);
  expect(restored.right + restored.width).toBeLessThanOrEqual(788);
  expect(restored.bottom).toBe(12);
});

test("默认阅读尺寸不妨碍主动缩小，过小临时浮窗与八方向调整共用下限", () => {
  const input = { viewportWidth: 1440, viewportHeight: 900, panelWidth: 264 };
  const minimum = resolveAssistantGeometry({ ...input, size: "compact", frame: { width: 360, height: 520, right: 16, bottom: 16 } });
  expect(minimum.width).toBe(360);
  expect(minimum.height).toBe(520);
  const restored = resolveAssistantGeometry({ ...input, size: "compact", frame: { width: 264, height: 280, right: 16, bottom: 16 } });
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


test("演示面板严格使用预留栏宽，正式窗口仍保留360px下限", () => {
  for (const viewportWidth of [760, 900, 1088, 1200, 1440]) {
    const panelWidth = Math.max(240, Math.min(viewportWidth * .26, 340));
    const inset = (viewportWidth < 1200 ? .75 : 1) * 14;
    const input = { viewportWidth, viewportHeight: 736, panelWidth, size: "expanded" as const, inset, uiScale: .875 };
    const panel = resolveAssistantGeometry({ ...input, widthMode: "panel" });
    const window = resolveAssistantGeometry(input);
    expect(panel.width).toBe(panelWidth);
    expect(window.width).toBe(Math.max(360 * .875, panelWidth));
    // 写作纸为轨道+30px留白预留空间；助手不能越过这条边界。
    const paperRight = viewportWidth - panelWidth - 30;
    expect(viewportWidth - panel.right - panel.width).toBeGreaterThan(paperRight);
    expect(panel.height + panel.bottom).toBe(736 - inset);
  }
});


test("常见屏幕自动收敛高度，窄屏与软键盘不裁切窗口", () => {
  for (const [viewportWidth, viewportHeight, expectedWidth, expectedHeight] of [
    [1920, 1080, 400, 640], [1440, 900, 400, 640],
    [1366, 768, 400, 552], [1280, 720, 400, 516], [390, 844, 366, 615],
  ] as const) {
    const geometry = resolveAssistantGeometry({ viewportWidth, viewportHeight, panelWidth: ASSISTANT_DEFAULT_WIDTH, size: "compact" });
    expect(geometry.width).toBe(expectedWidth);
    expect(geometry.height).toBe(expectedHeight);
    expect(geometry.width + geometry.right + geometry.inset).toBeLessThanOrEqual(viewportWidth);
    expect(geometry.height + geometry.bottom + geometry.inset).toBeLessThanOrEqual(viewportHeight);
    expect(geometry.height).toBeLessThanOrEqual((viewportHeight - geometry.inset * 2) * .75 + 1);
  }
});
