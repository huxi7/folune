/**
 * [INPUT]: 依赖 React 的原生 input 完整属性与 ref 能力，依赖 index.css 暴露的 ds-input 微拟物输入类
 * [OUTPUT]: 对外提供支持原生 ref 的 Input 组件
 * [POS]: app/src/shared/design-system/components 的输入基础件，被 NotesWorkspace 与认证验证码表单消费；AI 对话输入由 Kumo Input 独立承担
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ComponentPropsWithRef } from "react";

type InputProps = ComponentPropsWithRef<"input">;

export function Input({ className = "", type = "text", ...props }: InputProps) {
  return (
    <input
      className={[
        "ds-input",
        className,
      ].join(" ")}
      type={type}
      {...props}
    />
  );
}
