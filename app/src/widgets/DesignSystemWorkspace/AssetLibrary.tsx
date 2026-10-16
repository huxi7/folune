/**
 * [INPUT]: 依赖 assetCatalog 的当前资产与 BrandMark、BrandWordmark
 * [OUTPUT]: 提供 AssetLibrary，展示品牌组合、媒体预览、尺寸、格式与下载入口
 * [POS]: DesignSystemWorkspace 的资产陈列；视频仅按用户操作播放，名称承担检索语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { BrandWordmark } from "../../shared/design-system/components/BrandWordmark";
import { searchDesignAssets, type DesignAsset } from "./assetCatalog";
import "../../styles/design-system-assets.css";

function AssetPreview({ asset }: { asset: DesignAsset }) {
  if (asset.kind === "video") {
    return <video
      aria-label={`${asset.name}视频预览`}
      controls
      height={asset.height}
      muted
      playsInline
      poster={asset.poster}
      preload="none"
      src={asset.src}
      title={`${asset.name}视频预览`}
      width={asset.width}
    />;
  }
  if (asset.kind === "font") {
    return <span className="ds-asset-font" style={{ fontFamily: asset.fontFamily }}>
      <span>Aa</span><small>Folune 0123456789</small>
    </span>;
  }
  return <img
    alt={asset.name}
    decoding="async"
    height={asset.height}
    loading="lazy"
    src={asset.src}
    width={asset.width}
  />;
}

function AssetCard({ asset }: { asset: DesignAsset }) {
  const format = asset.src.split(".").pop()?.toUpperCase();
  const dimensions = asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.detail;
  return <article className="ds-asset-card" data-kind={asset.kind}>
    <div className="ds-asset-preview"><AssetPreview asset={asset} /></div>
    <div className="ds-asset-copy">
      <h4>{asset.name}</h4>
      <a aria-label={`打开${asset.name}`} href={asset.src} rel="noreferrer" target="_blank">打开 <span aria-hidden="true">↗</span></a>
      <p>{format}{dimensions && <> · {dimensions}</>}</p>
    </div>
  </article>;
}

export function AssetLibrary({ query = "" }: { query?: string }) {
  const { groups: visibleGroups, downloads, showLockups, hasResults } = searchDesignAssets(query);
  return <div className="ds-asset-library">
    {showLockups && <div className="ds-asset-lockups" aria-label="品牌组合">
      <div><BrandMark /><small>图字组合</small></div>
      <div><BrandMark iconOnly /><small>纸标</small></div>
      <div className="ds-asset-wordmark"><BrandWordmark /><small>字标</small></div>
    </div>}
    {visibleGroups.map(group => <section className="ds-asset-group" id={`assets-${group.id}`} key={group.id}>
      <header><h3>{group.name}</h3><span>{group.assets.length}</span></header>
      <div className="ds-asset-grid">{group.assets.map(asset => <AssetCard asset={asset} key={asset.src} />)}</div>
    </section>)}
    {downloads.length > 0 && <nav aria-label="原图与许可下载" className="ds-asset-downloads">{downloads.map(asset => <a download href={asset.src} key={asset.src}>{asset.name} <span aria-hidden="true">↓</span></a>)}</nav>}
    {!hasResults && <p className="ds-material-intro">没有匹配的资产。</p>}
  </div>;
}
