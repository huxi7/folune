/**
 * [INPUT]: 依赖 useSavedStudies 的本地收藏和 LabController 的快照/预览能力
 * [OUTPUT]: 对外提供命名收藏列表、只读对照、载入副本与 JSON 备份交换
 * [POS]: 参数面板的次要操作区，收藏原件与实时调参分开，刷新后从本机恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useRef, useState } from "react";
import { choiceName } from "./presets";
import type { LabController } from "./useLabState";
import { useSavedStudies } from "./useSavedStudies";
import type { SavedStudy } from "./useSavedStudies";

function StudyRow({ entry, lab, gallery }: { entry: SavedStudy; lab: LabController; gallery: ReturnType<typeof useSavedStudies> }) {
  const [name, setName] = useState(entry.name);
  const active = lab.comparing && lab.pinned?.frame === entry.snapshot.frame && lab.pinned?.choice === entry.snapshot.choice && JSON.stringify(lab.pinned?.params) === JSON.stringify(entry.snapshot.params);
  return <li className="grain-lab-study" data-active={active}>
    <input aria-label={`重命名收藏：${entry.name}`} value={name} maxLength={60} onChange={event => setName(event.target.value)} onBlur={() => { if (name.trim()) gallery.rename(entry, name); else setName(entry.name); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
    <small>{choiceName(entry.snapshot.choice)} · {entry.snapshot.height}svh · 浓淡 {Math.round(entry.snapshot.params.strength * 100)}%</small>
    <div className="grain-lab-button-row"><button type="button" aria-pressed={active} onClick={() => lab.preview(entry.snapshot)}>对照</button><button type="button" onClick={() => lab.restore(entry.snapshot)}>载入调整</button><button type="button" onClick={() => gallery.remove(entry)}>删除</button></div>
  </li>;
}
export function SavedStudies({ lab }: { lab: LabController }) {
  const gallery = useSavedStudies();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([gallery.exportAll()], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "folune-hero-studies.json";
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage("导出失败，请尝试复制当前配置。"); }
  }
  return <section className="grain-lab-control-section" aria-label="本地收藏">
    <div className="grain-lab-section-title"><h3>本地收藏</h3><span>{gallery.entries.length} 组</span></div>
    <div className="grain-lab-save-row"><input aria-label="新收藏名称" placeholder="起个名字，例如：更有纸感" value={name} maxLength={60} onChange={event => setName(event.target.value)} /><button type="button" onClick={() => {
      if (gallery.save(lab.capture(), name)) { setName(""); setMessage("已保存到本机，刷新后仍可对照。"); }
    }}>保存当前</button></div>
    <label className="grain-lab-check"><input type="checkbox" checked={lab.lockHeight} onChange={event => lab.setLockHeight(event.target.checked)} />对照时沿用当前高度</label>
    <p className="grain-lab-help">收藏保留各自参数和时刻；取消上项可比较收藏原高度。“载入调整”使用副本。</p>
    {gallery.entries.length ? <ul className="grain-lab-studies">{gallery.entries.map(entry => <StudyRow key={`${entry.id}-${entry.name}`} entry={entry} lab={lab} gallery={gallery} />)}</ul> : <p className="grain-lab-help">调到喜欢的画面后保存，可收藏多组同一方案。</p>}
    {lab.comparing && <button type="button" className="grain-lab-compare" onClick={lab.compare}>返回正在调整的方案</button>}
    {gallery.deleted && <button type="button" className="grain-lab-text-button" onClick={gallery.undo}>撤销删除「{gallery.deleted.name}」</button>}
    <div className="grain-lab-button-row"><button type="button" onClick={download}>导出全部收藏</button><button type="button" onClick={() => file.current?.click()}>导入收藏</button></div>
    <input ref={file} type="file" accept="application/json,.json" hidden onChange={async event => {
      const selected = event.target.files?.[0]; event.target.value = "";
      if (!selected) return;
      if (selected.size > 2_000_000) { setMessage("请选择小于 2MB 的收藏配置。"); return; }
      try { if (gallery.importAll(await selected.text())) setMessage("已合并收藏备份，原收藏保持不变。"); }
      catch { setMessage("文件无法读取，请重新选择。"); }
    }} />
    <p className="grain-lab-notice" role="status">{gallery.error || message}</p>
    <p className="grain-lab-help">保存在当前浏览器的本站数据中；刷新不会丢失。导出备份可转移到其他浏览器。</p>
  </section>;
}
