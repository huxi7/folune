/**
 * [INPUT]: 依赖产品已消费的品牌、认证、账户、截图与字体文件
 * [OUTPUT]: 提供资产目录、原图与许可下载和按名称检索的 searchDesignAssets
 * [POS]: DesignSystemWorkspace 的资产索引；只收录当前设计资产，不将存档列为规范
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { matchesReference } from "./search";

export type DesignAsset = {
  name: string;
  src: string;
  kind: "image" | "video" | "font";
  width?: number;
  height?: number;
  poster?: string;
  fontFamily?: string;
  detail?: string;
};

export type DesignAssetGroup = {
  id: string;
  name: string;
  assets: readonly DesignAsset[];
};

export const assetGroups: readonly DesignAssetGroup[] = [
  {
    id: "brand",
    name: "品牌",
    assets: [
      { name: "纸标", src: "/brand/folune-tight.png", kind: "image", width: 791, height: 851 },
      { name: "浏览器图标", src: "/brand/favicon-32.png", kind: "image", width: 32, height: 32 },
      { name: "浏览器图标 · 大尺寸", src: "/brand/favicon-192.png", kind: "image", width: 192, height: 192 },
      { name: "创作者头像", src: "/brand/huxi-avatar.jpg", kind: "image", width: 400, height: 400 },
    ],
  },
  {
    id: "editorial-media",
    name: "图像与视频",
    assets: [
      { name: "书房与花园", src: "/auth/study-garden.mp4", poster: "/auth/study-garden-poster.jpg", kind: "video", width: 720, height: 960 },
      { name: "书房与花园 · 首帧", src: "/auth/study-garden-poster.jpg", kind: "image", width: 720, height: 960 },
      { name: "积分横幅", src: "/account/credits-header-blue.png", kind: "image", width: 2170, height: 725 },
      { name: "简体中文", src: "/account/flag-cn.svg", kind: "image", width: 32, height: 32 },
      { name: "English", src: "/account/flag-us.svg", kind: "image", width: 32, height: 32 },
      { name: "纸纹", src: "/landing-reference/grain.png", kind: "image", width: 256, height: 256 },
    ],
  },
  {
    id: "product-screenshots",
    name: "产品截图",
    assets: [
      { name: "AI 整理", src: "/landing-features/organize.png", kind: "image", width: 1888, height: 1062 },
      { name: "知识画布", src: "/landing-features/canvas.png", kind: "image", width: 2304, height: 1296 },
      { name: "Paper 阅读", src: "/landing-features/paper.png", kind: "image", width: 1664, height: 936 },
      { name: "笔记引用", src: "/landing-features/references.png", kind: "image", width: 896, height: 504 },
      { name: "正文搜索", src: "/landing-features/search.png", kind: "image", width: 1420, height: 798 },
      { name: "选择材料", src: "/landing-details/references.png", kind: "image", width: 1752, height: 688 },
      { name: "展开原文", src: "/landing-details/original.png", kind: "image", width: 1216, height: 816 },
      { name: "Markdown 导出", src: "/landing-details/markdown.png", kind: "image", width: 2496, height: 1760 },
    ],
  },
  {
    id: "fonts",
    name: "字体",
    assets: [
      { name: "Montserrat", src: "/fonts/montserrat-latin-variable.woff2", kind: "font", fontFamily: "Montserrat", detail: "300–700" },
      { name: "iA Writer Quattro", src: "/landing-reference/iAWriterQuattroS_Regular.woff2", kind: "font", fontFamily: "Landing Writer", detail: "Regular" },
      { name: "IBM Plex Serif", src: "/landing-reference/IBMPlexSerif_Var.woff2", kind: "font", fontFamily: "Landing Serif", detail: "100–900" },
      { name: "Lilex", src: "/landing-reference/Lilex_Regular.woff2", kind: "font", fontFamily: "Landing Mono", detail: "Regular" },
    ],
  },
];

export const assetDownloads = [
  { name: "品牌原图", src: "/brand/folune.png" },
  { name: "字标许可", src: "/brand/OFL-source-serif-4.txt" },
  { name: "Montserrat 许可", src: "/fonts/Montserrat-OFL.txt" },
  { name: "登录图标许可", src: "/octicons-LICENSE.txt" },
] as const;

export function searchDesignAssets(query: string) {
  const groups = assetGroups.map(group => ({
    ...group,
    assets: group.assets.filter(asset => matchesReference(`资产 资源 asset resource library ${group.id} ${group.name} ${asset.name} ${asset.kind} ${asset.detail ?? ""} ${asset.src.split(".").pop()}`, query)),
  })).filter(group => group.assets.length > 0);
  const downloads = assetDownloads.filter(asset => matchesReference(`资产 资源 下载 ${asset.name}`, query));
  const showLockups = matchesReference("品牌 标志 字标 图字组合 logo brand Folune", query);
  return { groups, downloads, showLockups, hasResults: showLockups || groups.length > 0 || downloads.length > 0 };
}
