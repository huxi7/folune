/**
 * [INPUT]: Bun test 与 manipulationBorderGeometry
 * [OUTPUT]: 验证相位只向前传播、右下/左上两端闭合及静态波形稳定
 * [POS]: 按住纸边的方向与几何门禁，不以参数字符串冒充实际运动
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { BORDER_FLOW_SPEED, borderTravelWave, createBorderBranches, manipulationBorderPath } from "./manipulationBorderGeometry";

test("同一波形随时间只向右下到左上的距离方向传播", () => {
  for (const seconds of [0, 1, 5.9, 6.1, 100]) {
    for (const distance of [0, 50, 170, 490]) {
      expect(borderTravelWave(distance + BORDER_FLOW_SPEED * 0.2, seconds + 0.2))
        .toBeCloseTo(borderTravelWave(distance, seconds), 9);
    }
  }
});

test("两路共享右下起点和左上终点，收束端点不被波形扯开", () => {
  for (const squircle of [false, true]) {
    const [upper, lower] = createBorderBranches(280, 360, 16, squircle);
    for (const end of [0, -1]) {
      expect(upper!.at(end)!.x).toBeCloseTo(lower!.at(end)!.x, 9);
      expect(upper!.at(end)!.y).toBeCloseTo(lower!.at(end)!.y, 9);
      expect(upper!.at(end)!.envelope).toBe(0);
      expect(lower!.at(end)!.envelope).toBe(0);
    }
    for (const branch of [upper!, lower!]) {
      for (let i = 1; i < branch.length; i++) expect(branch[i]!.distance).toBeGreaterThanOrEqual(branch[i - 1]!.distance);
    }
  }
});

test("闭合描边有限且保持静态相位，窄尺寸不产生无效路径", () => {
  for (const [width, height] of [[280, 360], [12, 8], [0, 0]]) {
    const branches = createBorderBranches(width!, height!, 16, true);
    const first = manipulationBorderPath(branches, 0);
    expect(first).toBe(manipulationBorderPath(branches, 0));
    expect(first).not.toMatch(/NaN|Infinity/);
    expect(first.endsWith(" Z")).toBe(true);
  }
});
