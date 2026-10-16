/**
 * [INPUT]: 依赖生产组件目录、资产目录、真实 ThemeProvider 与品牌材质样板
 * [OUTPUT]: 导出独立 DesignSystemWorkspace，提供紧凑目录、检索、主题切换与组件样板
 * [POS]: DEV /design-system 页面入口；不读取账户，不挂载产品工作区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark, Button, Input, SegmentedControl, type SegmentedControlOption } from "../../shared/design-system/components";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "../../shared/design-system/icons";
import { useTheme, type Theme } from "../../shared/theme/ThemeProvider";
import { AssetLibrary } from "./AssetLibrary";
import { MaterialSpecimens, hasMaterialSamples } from "./MaterialSpecimens";
import { searchDesignAssets } from "./assetCatalog";
import { matchesReference } from "./search";
import { ProductSpecimens, hasProductSamples } from "./ProductSpecimens";
import { ComponentTile } from "./ComponentTile";
import { designSystemSamples, designSystemSections, matchesDesignSample } from "./componentCatalog";
import "../../styles/design-system-workspace.css";
import "../../styles/design-system-shell.css";

const themeOptions: SegmentedControlOption<Theme>[] = [
  { label: "跟随系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
];

export function DesignSystemWorkspace() {
  const { setTheme, theme } = useTheme();
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("brand");
  const samples = useMemo(() => designSystemSamples.filter(sample => matchesDesignSample(sample, query) || designSystemSections.some(section => section.category === sample.category && matchesReference(`${section.title} ${section.category}`, query))), [query]);
  const searching = query.trim().length > 0;
  const showMaterials = hasMaterialSamples(query);
  const assetResults = searchDesignAssets(query);
  const showProduct = hasProductSamples(query);
  const sections = designSystemSections.filter(section => (section.category === "Assets" && assetResults.hasResults)
    || (section.category === "Materials & Motion" && showMaterials)
    || (section.category === "AI & Organize" && showProduct)
    || samples.some(sample => sample.category === section.category));

  useEffect(() => {
    const previous = document.title;
    document.title = "Design System · Folune";
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: "-96px 0px -65% 0px", threshold: 0 });
    document.querySelectorAll<HTMLElement>(".ds-reference-section").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [query]);

  return (
    <div className="ds-reference">
      <a className="ds-reference-skip" href="#design-content">跳到设计内容</a>
      <header className="ds-reference-topbar">
        <Link aria-label="Folune 首页" className="ds-reference-brand" to="/"><BrandMark /></Link>
        <h1 className="ds-reference-topbar-title">Design System</h1>
        <div className="ds-reference-topbar-actions">
          <SegmentedControl ariaLabel="Design System 主题" onValueChange={setTheme} options={themeOptions} size="compact" value={theme} />
          <Link className="ds-reference-return" to="/app"><ArrowLeftIcon aria-hidden="true" size={14} /><span>工作区</span></Link>
        </div>
      </header>
      <div className="ds-reference-layout">
        <aside className="ds-reference-rail">
          <label className="ds-reference-search" htmlFor="design-system-search">
            <span className="sr-only">搜索设计元素和资产</span>
            <MagnifyingGlassIcon aria-hidden="true" size={16} />
            <Input id="design-system-search" onChange={event => setQuery(event.target.value)} placeholder="搜索设计元素" type="search" value={query} />
          </label>
          <nav aria-label="Design System 目录">
            {sections.map(section => (
              <a aria-current={activeSection === section.id ? "location" : undefined} href={`#${section.id}`} key={section.id} onClick={() => setActiveSection(section.id)}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
        <main className="ds-reference-main" id="design-content" tabIndex={-1}>
          {searching && <div className="ds-reference-results" role="status"><p>“{query}” 的匹配结果</p><Button onClick={() => setQuery("")} variant="ghost">清除搜索</Button></div>}
          {searching && sections.length === 0 && <p className="ds-reference-empty">没有找到匹配项。试试组件名称或用途。</p>}
          {sections.map(section => {
            const sectionSamples = samples.filter(sample => sample.category === section.category);
            return (
              <section aria-labelledby={`${section.id}-title`} className="ds-reference-section" id={section.id} key={section.id}>
                <header className="ds-reference-section-heading">
                  <h2 id={`${section.id}-title`}>{section.title}</h2>
                </header>
                {sectionSamples.length > 0 && <div className="design-system-matrix">{sectionSamples.map(sample => <ComponentTile key={sample.id} sample={sample} />)}</div>}
                {section.category === "AI & Organize" && showProduct && <ProductSpecimens query={query} />}
                {section.category === "Materials & Motion" && showMaterials && <MaterialSpecimens query={query} />}
                {section.category === "Assets" && <AssetLibrary query={query} />}
              </section>
            );
          })}
          <footer className="ds-reference-footer"><span>Folune Design System</span><a href="#design-content">回到顶部 ↑</a></footer>
        </main>
      </div>
    </div>
  );
}
