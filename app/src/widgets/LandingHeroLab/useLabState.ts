/**
 * [INPUT]: 依赖 React、参数协议与背景公开的时间读取接口
 * [OUTPUT]: 对外提供逐方案调参、暂停、定格对照和配置导入导出状态
 * [POS]: Lab 唯一交互状态；仅使用专属 localStorage 键，时间按操作采样而非逐帧进入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { defaults, defaultSnapshot, initialFrame, isChoice, isVariant, parseSnapshot, references, storageKey, variants } from "./presets";
import type { Choice, Parameters, Snapshot } from "./presets";
import type { ArtworkHandle } from "./HeroArtwork";

type Bank = Record<Choice, Snapshot>;
type LabState = { choice: Choice; height: number; bank: Bank; pinned: Snapshot | null };
function initialState(): LabState {
  const bank = Object.fromEntries([...variants, ...references].map(({ id }) => [id, {
    ...defaultSnapshot(), choice: id, params: { ...(isVariant(id) ? defaults[id] : defaults.ink) },
  }])) as Bank;
  const state: LabState = { choice: "ink", height: 68, bank, pinned: null };
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LabState>;
      if (saved.bank) for (const id of Object.keys(bank) as Choice[]) {
        const entry = saved.bank[id];
        if (entry) { const parsed = parseSnapshot(entry); if (parsed.choice === id) bank[id] = parsed; }
      }
      if (isChoice(saved.choice)) state.choice = saved.choice;
      if (typeof saved.height === "number" && saved.height >= 50 && saved.height <= 85) state.height = saved.height;
      if (saved.pinned) state.pinned = parseSnapshot(saved.pinned);
    }
  } catch { /* 旧配置或存储不可用时仍能用完整默认方案 */ }
  const hash = window.location.hash.slice(1);
  if (isChoice(hash)) state.choice = hash;
  return state;
}

export function useLabState() {
  const [state, setState] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState("");
  const artwork = useRef<ArtworkHandle>(null);
  const current: Snapshot = { ...state.bank[state.choice], height: state.height };
  const displayed: Snapshot = comparing && state.pinned ? { ...state.pinned, height: state.height, frame: current.frame } : current;
  const sample = () => artwork.current?.getFrame() ?? displayed.frame;

  useEffect(() => {
    const save = () => {
      const bank = { ...state.bank };
      if (!comparing) bank[state.choice] = { ...bank[state.choice], frame: artwork.current?.getFrame() ?? bank[state.choice].frame };
      try { localStorage.setItem(storageKey, JSON.stringify({ ...state, bank })); }
      catch { setNotice("浏览器未允许本地保存，可复制配置保留调整。"); }
    };
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [state, comparing]);

  const select = useCallback((choice: Choice) => {
    const phase = artwork.current?.getFrame();
    setState(previous => {
      const bank = { ...previous.bank };
      if (!comparing) bank[previous.choice] = { ...bank[previous.choice], frame: phase ?? bank[previous.choice].frame };
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
    setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: {
      ...previous.bank[previous.choice], params: { ...previous.bank[previous.choice].params, [key]: value },
    } } }));
  }
  function togglePaused() {
    if (!paused) {
      const frame = sample();
      setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: { ...previous.bank[previous.choice], frame } } }));
    }
    setComparing(false);
    setPaused(value => !value);
  }
  function pin() {
    const snapshot = { ...current, params: { ...current.params }, frame: sample() };
    setState(previous => ({ ...previous, pinned: snapshot, bank: { ...previous.bank, [previous.choice]: snapshot } }));
    setPaused(true);
    setComparing(false);
    setNotice("已固定当前画面。继续调参或换方案后，点“对照”比较；高度与时间保持一致。");
  }
  function compare() {
    if (!state.pinned) return;
    if (!comparing) {
      const frame = state.pinned.frame;
      artwork.current?.setFrame(frame);
      setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: { ...previous.bank[previous.choice], frame } } }));
    }
    setPaused(true);
    setComparing(value => !value);
  }
  function reset() {
    artwork.current?.setFrame(initialFrame);
    setComparing(false);
    setState(previous => ({ ...previous, bank: { ...previous.bank, [previous.choice]: {
      ...previous.bank[previous.choice], params: { ...(isVariant(previous.choice) ? defaults[previous.choice] : defaults.ink) }, frame: initialFrame,
    } } }));
    setNotice("已恢复当前方案默认参数，高度保持不变。");
  }
  function exportConfig() { return JSON.stringify({ ...displayed, frame: sample() }, null, 2); }
  function importConfig(text: string) {
    try {
      const snapshot = parseSnapshot(JSON.parse(text));
      artwork.current?.setFrame(snapshot.frame);
      setState(previous => ({ ...previous, choice: snapshot.choice, height: snapshot.height, bank: { ...previous.bank, [snapshot.choice]: snapshot } }));
      setPaused(true);
      setComparing(false);
      window.history.replaceState(null, "", `#${snapshot.choice}`);
      setNotice("配置已载入并定格在保存时刻，可点击播放。");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "配置格式无法读取。");
      return false;
    }
  }
  return {
    artwork, current, displayed, paused, comparing, notice, pinned: state.pinned,
    select, update, togglePaused, pin, compare, reset, exportConfig, importConfig, setNotice,
    setHeight: (height: number) => setState(previous => ({ ...previous, height })),
  };
}
export type LabController = ReturnType<typeof useLabState>;
