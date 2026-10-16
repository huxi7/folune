/**
 * [INPUT]: 依赖资产目录、public 文件与正式页面的资源引用
 * [OUTPUT]: 约束资产可读、展示资产确有消费，且存档不能被检索为设计资产
 * [POS]: DesignSystemWorkspace 的资产完整性门禁；生产引用退出后目录必须同步收敛
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assetDownloads, assetGroups, searchDesignAssets } from "./assetCatalog";

const appRoot = resolve(import.meta.dir, "../../..");
const currentAssets = assetGroups.flatMap(group => group.assets);
const productionReferences = [
  "index.html",
  "src/shared/design-system/components/BrandMark.tsx",
  "src/shared/design-system/components/UserMenu.tsx",
  "src/widgets/landingBlogData.ts",
  "src/widgets/landingDetailData.ts",
  "src/widgets/CreditsPurchaseDialog.tsx",
  "src/pages/LoginPage.tsx",
  "src/styles/landing.css",
  "src/styles/account-typography.css",
].map(path => readFileSync(resolve(appRoot, path), "utf8")).join("\n");
const landingSections = readFileSync(resolve(appRoot, "src/widgets/LandingSections.tsx"), "utf8");

describe("Design System 资产目录", () => {
  test("每个预览与下载文件存在", () => {
    for (const asset of [...currentAssets, ...assetDownloads]) {
      expect(existsSync(resolve(appRoot, "public", asset.src.slice(1)))).toBe(true);
    }
    for (const asset of currentAssets) {
      if (asset.poster) expect(existsSync(resolve(appRoot, "public", asset.poster.slice(1)))).toBe(true);
    }
  });

  test("展示资产在正式页面中确有引用", () => {
    for (const asset of currentAssets) {
      if (asset.src.startsWith("/landing-features/")) {
        expect(landingSections).toContain('src={`/landing-features/${feature.image}.png`}');
        expect(landingSections).toContain(`image: "${asset.src.split("/").pop()?.replace(".png", "")}"`);
      } else expect(productionReferences).toContain(asset.src);
    }
  });

  test("目录不重复文件，也不包含历史参考", () => {
    const paths = new Set([...currentAssets, ...assetDownloads].map(asset => asset.src));
    expect(paths.size).toBe(currentAssets.length + assetDownloads.length);
    expect(currentAssets.some(asset => asset.src.startsWith("/landing-connections/"))).toBe(false);
    expect(paths.has("/account/credits-header-haze.webp")).toBe(false);
    expect(searchDesignAssets("历史").hasResults).toBe(false);
    expect(searchDesignAssets("保留参考").hasResults).toBe(false);
    expect(searchDesignAssets("folune-tight").hasResults).toBe(false);
    expect(searchDesignAssets("品牌 纸标").groups.flatMap(group => group.assets).map(asset => asset.src)).toEqual(["/brand/folune-tight.png"]);
  });
});
