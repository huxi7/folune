/**
 * [INPUT]: 依赖 React 的原生 input 完整属性与 ref 能力、Motion for React 焦点手势，依赖 index.css 暴露的 ds-input 微拟物输入类
 * [OUTPUT]: 对外提供支持原生 ref 与轻量 Spring 焦点反馈的 Input 组件
 * [POS]: app/src/shared/design-system/components 的单行输入基础件，被 NotesWorkspace 与认证验证码表单消费；AI 内联引用输入由同目录原生 MentionInput 承担
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ComponentPropsWithRef, ComponentType } from "react";
import { motion } from "motion/react";

import { snappy } from "../../../lib/motion.js";

const MotionInput = motion.input as unknown as ComponentType<
  ComponentPropsWithRef<"input"> & { whileFocus?: unknown }
>;

type InputProps = Omit<ComponentPropsWithRef<"input">, "onDrag" | "onDragStart" | "onDragEnd">;

export function Input({ className = "", type = "text", ...props }: InputProps) {
  return (
    <MotionInput
      className={[
        "ds-input",
        className,
      ].join(" ")}
      type={type}
      whileFocus={{ scale: 1.005, transition: snappy }}
      {...props}
    />
  );
}
