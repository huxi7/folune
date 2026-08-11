/**
 * [INPUT]: 依赖聊天 Composer 的文本值、忙碌状态与浏览器键盘事件语义
 * [OUTPUT]: 对外提供 canSubmitComposer 与 isComposerSubmitKey 纯判定
 * [POS]: AgentPanel 的输入交互边界，集中保护空白提交、组合输入与修饰键行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type ComposerKeyState = {
  altKey: boolean;
  ctrlKey: boolean;
  isComposing: boolean;
  key: string;
  keyCode?: number;
  metaKey: boolean;
  shiftKey: boolean;
};

export function canSubmitComposer(value: string, busy: boolean) {
  return !busy && value.trim().length > 0;
}

export function isComposerSubmitKey({
  altKey,
  ctrlKey,
  isComposing,
  key,
  keyCode,
  metaKey,
  shiftKey,
}: ComposerKeyState) {
  return key === "Enter"
    && !altKey
    && !ctrlKey
    && !metaKey
    && !shiftKey
    && !isComposing
    && keyCode !== 229;
}
