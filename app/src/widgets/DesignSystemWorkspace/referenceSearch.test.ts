/**
 * [INPUT]: 依赖材质检索、资产检索与组件目录
 * [OUTPUT]: 锁定中文材质、Truchet、品牌组合及多词检索的真实入口
 * [POS]: Design System 搜索回归门禁；分区可见性与内部结果必须一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { searchDesignAssets } from "./assetCatalog";
import { hasMaterialSamples } from "./MaterialSpecimens";
import { designSystemSamples, matchesDesignSample } from "./componentCatalog";

describe("Design System 跨目录搜索", () => {
  test("实际材质名称都能打开材料分区", () => {
    for (const query of ["Truchet", "登录", "散墨", "点阵", "导轨", "网格", "HERO 背景"]) expect(hasMaterialSamples(query)).toBe(true);
    expect(hasMaterialSamples("不存在的材质")).toBe(false);
  });
  test("品牌组合本身构成有效结果", () => {
    const result = searchDesignAssets("logo");
    expect(result.showLockups).toBe(true);
    expect(result.groups).toHaveLength(0);
    expect(result.hasResults).toBe(true);
    expect(searchDesignAssets("不存在的资源").hasResults).toBe(false);
  });
  test("组件与资产都支持大小写和多词条件", () => {
    const asset = searchDesignAssets("品牌 纸标").groups.flatMap(group => group.assets);
    expect(asset.map(item => item.src)).toEqual(["/brand/folune-tight.png"]);
    expect(designSystemSamples.filter(sample => matchesDesignSample(sample, "button 按钮")).map(sample => sample.id)).toEqual(["Button", "GlowButton"]);
    expect(designSystemSamples.filter(sample => matchesDesignSample(sample, "button 不存在"))).toHaveLength(0);
  });
});
