/**
 * [INPUT]: 依赖共享键盘语义图标与浏览器平台标识，颜色/字号消费设计系统 token
 * [OUTPUT]: 对外提供 KeyboardShortcut，将组合键呈现为独立键帽；mod 与删除键按 Mac/其他平台显示
 * [POS]: 帮助说明与 Tooltip 共用的快捷键表现层，只解释已有键位，不注册任何按键行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CommandKeyIcon,
  DeleteKeyIcon,
  ReturnKeyIcon,
  SpaceKeyIcon,
} from "../icons";
import "./KeyboardShortcut.css";

type KeyboardShortcutProps = { keys: readonly string[] };

export function KeyboardShortcut({ keys }: KeyboardShortcutProps) {
  const isMac = /mac|ipad|iphone/iu.test(globalThis.navigator?.platform ?? "");
  const keycaps = keys.map((key) => {
    if (key === "mod") return isMac
      ? { label: "Command", content: <CommandKeyIcon aria-hidden size={14} /> }
      : { label: "Ctrl", content: "Ctrl" };
    if (key === "Enter") return { label: "Enter", content: <ReturnKeyIcon aria-hidden size={14} /> };
    if (key === "Space") return { label: "空格", content: <><SpaceKeyIcon aria-hidden size={14} /><span>空格</span></> };
    if (key === "Backspace") return isMac
      ? { label: "Delete", content: <DeleteKeyIcon aria-hidden size={14} /> }
      : { label: "Backspace", content: <DeleteKeyIcon aria-hidden size={14} /> };
    return { label: key, content: key };
  });

  return (
    <span className="ds-keyboard-shortcut" aria-label={keycaps.map((key) => key.label).join(" + ")}>
      {keycaps.map((key, index) => <kbd aria-hidden="true" className="ds-keycap" key={`${keys[index]}-${index}`}>{key.content}</kbd>)}
    </span>
  );
}
