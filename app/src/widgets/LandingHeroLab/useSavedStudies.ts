/**
 * [INPUT]: 依赖浏览器 localStorage 与版本化 Snapshot 校验
 * [OUTPUT]: 对外提供多组命名收藏、重命名/删除撤销、备份和旧单对照迁移
 * [POS]: 收藏持久化边界；一条收藏一个键，跨标签事件只读合并，不自动覆盖其他窗口数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { choiceName, galleryKey, legacyStorageKey, parseSnapshot, storageKey } from "./presets";
import type { Snapshot } from "./presets";

export type SavedStudy = { id: string; name: string; createdAt: number; snapshot: Snapshot };
const prefix = `${galleryKey}:item:`;
const parseStudy = (raw: unknown): SavedStudy => {
  if (!raw || typeof raw !== "object") throw new Error("收藏格式错误。");
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || typeof entry.name !== "string" || !entry.name.trim() || typeof entry.createdAt !== "number" || !Number.isFinite(entry.createdAt)) throw new Error("收藏内容不完整。");
  return { id: entry.id, name: entry.name.trim().slice(0, 60), createdAt: entry.createdAt, snapshot: parseSnapshot(entry.snapshot) };
};
function readStudies(): SavedStudy[] {
  const entries: SavedStudy[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const entry = parseStudy(JSON.parse(localStorage.getItem(key) ?? "null"));
      if (key === prefix + entry.id) entries.push(entry);
    } catch { /* 不删除损坏数据，其他收藏继续可读 */ }
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}
export function useSavedStudies() {
  const [entries, setEntries] = useState<SavedStudy[]>([]);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState<SavedStudy | null>(null);
  useEffect(() => {
    const reload = () => { try { setEntries(readStudies()); } catch { setError("本地存储不可用；请使用配置导出保存。"); } };
    try {
      const marker = `${galleryKey}:migrated`;
      if (!localStorage.getItem(marker)) {
        for (const key of [storageKey, legacyStorageKey]) {
          const old = JSON.parse(localStorage.getItem(key) ?? "null");
          if (old?.pinned) {
            const entry = { id: "previous-pinned", name: "之前固定的对照", createdAt: Date.now(), snapshot: parseSnapshot(old.pinned) };
            if (!localStorage.getItem(prefix + entry.id)) localStorage.setItem(prefix + entry.id, JSON.stringify(entry));
            break;
          }
        }
        localStorage.setItem(marker, "1");
      }
    } catch { setError("旧对照未能迁移，原数据仍保留在本机。"); }
    reload();
    const sync = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(prefix)) reload(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function write(entry: SavedStudy) {
    try {
      localStorage.setItem(prefix + entry.id, JSON.stringify(entry));
      setEntries(readStudies()); setError(""); return true;
    } catch { setError("保存失败，浏览器存储可能已满或被禁用。可复制配置备份。"); return false; }
  }
  function save(snapshot: Snapshot, name: string) {
    return write({ id: crypto.randomUUID(), name: name.trim().slice(0, 60) || `${choiceName(snapshot.choice)} · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`, createdAt: Date.now(), snapshot: parseSnapshot(snapshot) });
  }
  function rename(entry: SavedStudy, name: string) { if (name.trim()) write({ ...entry, name: name.trim().slice(0, 60) }); }
  function remove(entry: SavedStudy) {
    try { localStorage.removeItem(prefix + entry.id); setDeleted(entry); setEntries(readStudies()); setError(""); }
    catch { setError("未能删除本地收藏。"); }
  }
  function undo() { if (deleted && write(deleted)) setDeleted(null); }
  function exportAll() { return JSON.stringify({ format: "folune-hero-studies", version: 1, entries: readStudies() }, null, 2); }
  function importAll(text: string) {
    const written: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (parsed.format !== "folune-hero-studies" || parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error("请选择本实验页导出的收藏备份。");
      const incoming = parsed.entries.map((item: unknown) => ({ ...parseStudy(item), id: crypto.randomUUID() }));
      // 先验证整份备份，再用全新 ID 合并；不会覆盖当前收藏。
      for (const entry of incoming) { localStorage.setItem(prefix + entry.id, JSON.stringify(entry)); written.push(prefix + entry.id); }
      setEntries(readStudies()); setError(""); return true;
    } catch (cause) {
      for (const key of written) { try { localStorage.removeItem(key); } catch { /* 已写入的副本不触碰旧收藏 */ } }
      setError(cause instanceof Error ? cause.message : "无法载入收藏备份。"); return false;
    }
  }
  return { entries, error, deleted, save, rename, remove, undo, exportAll, importAll };
}
