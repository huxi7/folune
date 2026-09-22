/**
 * [INPUT]: 依赖 React、版本化参数协议与背景公开时间接口
 * [OUTPUT]: 对外提供逐方案草稿、暂停、收藏预览与配置迁移/导入导出
 * [POS]: Lab 编辑状态；v1 只读迁移到 v2，启动时被否决 B 版回到同组 A 版，收藏预览不覆盖草稿
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { allChoices, defaults, defaultSnapshot, initialFrame, isChoice, isVariant, legacyStorageKey, parseSnapshot, storageKey } from "./presets";
import type { Choice, Parameters, Snapshot } from "./presets";
import type { ArtworkHandle } from "./HeroArtwork";

type Bank = Record<Choice, Snapshot>;
type LabState = { choice: Choice; height: number; bank: Bank; pinned: Snapshot | null };
function initialState(): LabState {
  const bank = Object.fromEntries(allChoices.map(({ id }) => [id, {
    ...defaultSnapshot(), choice: id, params: { ...(isVariant(id) ? defaults[id] : defaults.ink) },
  }])) as Bank;
  const state: LabState = { choice: "paper", height: 60, bank, pinned: null };
  try {
    const current = localStorage.getItem(storageKey);
    const raw = current ?? localStorage.getItem(legacyStorageKey);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LabState>;
      if (saved.bank) for (const id of Object.keys(bank) as Choice[]) {
        try { const entry = parseSnapshot(saved.bank[id]); if (entry.choice === id) bank[id] = entry; } catch { /* 单个旧记录损坏不丢其他草稿 */ }
      }
      if (current && isChoice(saved.choice)) state.choice = saved.choice;
      if (typeof saved.height === "number" && Number.isFinite(saved.height) && saved.height >= 50 && saved.height <= 85) state.height = saved.height;
      if (saved.pinned) { try { state.pinned = parseSnapshot(saved.pinned); } catch { /* 仍保留其他有效配置 */ } }
    }
  } catch { /* 存储不可用时继续提供默认方案 */ }
  const hash = window.location.hash.slice(1);
  if (isChoice(hash)) state.choice = hash;
  if (state.choice === "ink-b") state.choice = "ink";
  if (state.choice === "paper-b") state.choice = "paper";
  return state;
}

export function useLabState() {
  const [state, setState] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [lockHeight, setLockHeight] = useState(true);
  const [notice, setNotice] = useState("");
  const artwork = useRef<ArtworkHandle>(null);
  const current: Snapshot = { ...state.bank[state.choice], height: state.height };
  const displayed: Snapshot = comparing && state.pinned ? { ...state.pinned, height: lockHeight ? state.height : state.pinned.height } : current;
  const sample = () => artwork.current?.getFrame() ?? displayed.frame;

  useEffect(() => {
    const save = () => {
      const bank = { ...state.bank };
      if (!comparing) bank[state.choice] = { ...bank[state.choice], height: state.height, frame: artwork.current?.getFrame() ?? bank[state.choice].frame };
      try { localStorage.setItem(storageKey, JSON.stringify({ ...state, bank })); }
      catch { setNotice("浏览器未允许保存草稿，可复制配置保留调整。"); }
    };
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [state, comparing]);

  const select = useCallback((choice: Choice) => {
    const phase = artwork.current?.getFrame();
    setState(previous => {
      const bank = { ...previous.bank };
      if (!comparing) bank[previous.choice] = { ...bank[previous.choice], height: previous.height, frame: phase ?? bank[previous.choice].frame };
      if (paused && phase !== undefined) bank[choice] = { ...bank[choice], frame: phase };
      return { ...previous, choice, bank };
    });
    setComparing(false);
    setNotice("");
    window.history.replaceState(null, "", `#${choice}`);
  }, [comparing, paused]);
  useEffect(() => {
    const sync = () => { const choice = window.location.hash.slice(1); if (isChoice(choice)) select(choice); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [select]);

  function update(key: keyof Parameters, value: number) {
    if (comparing) return;
    setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: {
      ...previous.bank[previous.choice], params: { ...previous.bank[previous.choice].params, [key]: value },
    } } }));
  }
  function togglePaused() {
    const frame = sample();
    if (comparing) {
      // 收藏继续播放时恢复为可编辑副本，原收藏不改变。
      setState(previous => ({ ...previous, choice: displayed.choice, height: displayed.height, bank: { ...previous.bank, [displayed.choice]: { ...displayed, frame } } }));
      window.history.replaceState(null, "", `#${displayed.choice}`);
    } else if (!paused) {
      setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: { ...previous.bank[previous.choice], frame } } }));
    }
    setComparing(false);
    setPaused(value => !value);
  }
  function capture(): Snapshot { return { ...displayed, params: { ...displayed.params }, frame: sample() }; }
  function pin() {
    const snapshot = capture();
    setState(previous => ({ ...previous, pinned: snapshot, bank: { ...previous.bank, [previous.choice]: snapshot } }));
    setPaused(true);
    setComparing(false);
    setNotice("已固定当前对照。需要刷新后保留多组方案，请存入下方收藏。");
  }
  function preview(snapshot: Snapshot) {
    const frame = sample();
    setState(previous => ({ ...previous, pinned: snapshot, bank: comparing ? previous.bank : { ...previous.bank, [previous.choice]: { ...previous.bank[previous.choice], frame } } }));
    setPaused(true);
    setComparing(true);
    artwork.current?.setFrame(snapshot.frame);
  }
  function compare() {
    if (!state.pinned) return;
    if (!comparing) preview(state.pinned);
    else { setComparing(false); artwork.current?.setFrame(current.frame); }
  }
  function reset() {
    artwork.current?.setFrame(initialFrame);
    setComparing(false);
    setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: {
      ...previous.bank[previous.choice], params: { ...(isVariant(previous.choice) ? defaults[previous.choice] : defaults.ink) }, frame: initialFrame,
    } } }));
    setNotice("已恢复此方案默认值，收藏与其他方案不变。");
  }
  function restore(snapshot: Snapshot) {
    snapshot = parseSnapshot(snapshot);
    artwork.current?.setFrame(snapshot.frame);
    setState(previous => ({ ...previous, choice: snapshot.choice, height: snapshot.height, bank: { ...previous.bank, [snapshot.choice]: snapshot } }));
    setPaused(true);
    setComparing(false);
    window.history.replaceState(null, "", `#${snapshot.choice}`);
    setNotice("已载入配置副本并定格，收藏原件保持不变。");
  }
  function exportConfig() { return JSON.stringify(capture(), null, 2); }
  function importConfig(text: string) {
    try { restore(parseSnapshot(JSON.parse(text))); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : "配置格式无法读取。"); return false; }
  }
  return {
    artwork, current, displayed, paused, comparing, notice, pinned: state.pinned, lockHeight, setLockHeight,
    select, update, togglePaused, pin, compare, preview, capture, restore, reset, exportConfig, importConfig, setNotice,
    setHeight: (height: number) => setState(previous => ({ ...previous, height })),
  };
}
export type LabController = ReturnType<typeof useLabState>;
