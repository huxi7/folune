/**
 * [INPUT]: 依赖 Motion 共享底片与 DS 时长、 React ref/键盘事件、共享 Lucide Icon 类型与 segmented-control.css 的语义 token 样式
 * [OUTPUT]: 对外提供受控 SegmentedControl（含主题与来源共用的 compact 尺寸）、SegmentedControlOption 与方向键/Home/End 单选交互
 * [POS]: app/src/shared/design-system/components 的紧凑互斥选择原子件，用于少量稳定选项，不替代 Select 或普通 Button
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { motion, useReducedMotion } from "motion/react";
import { fadeTransition, reducedFadeTransition } from "../motion";
import type { Icon } from "../icons";
import {
  useRef,
  useId,
  type KeyboardEvent,
} from "react";

export type SegmentedControlOption<Value extends string = string> = {
  disabled?: boolean;
  icon?: Icon;
  label: string;
  value: Value;
};

type SegmentedControlProps<Value extends string> = {
  ariaLabel: string;
  className?: string;
  size?: "default" | "compact";
  onValueChange: (value: Value) => void;
  options: ReadonlyArray<SegmentedControlOption<Value>>;
  value: Value;
};

const NAVIGATION_KEYS = [
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
] as const;

export function SegmentedControl<Value extends string>({
  ariaLabel,
  className = "",
  size = "default",
  onValueChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  const selectionId = useId();
  const reduced = useReducedMotion();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (!NAVIGATION_KEYS.includes(event.key as (typeof NAVIGATION_KEYS)[number])) {
      return;
    }

    const enabledIndices = options.flatMap((option, index) =>
      option.disabled ? [] : [index],
    );

    if (enabledIndices.length === 0) {
      return;
    }

    event.preventDefault();
    const currentPosition = Math.max(enabledIndices.indexOf(currentIndex), 0);
    const nextPosition = event.key === "Home"
      ? 0
      : event.key === "End"
        ? enabledIndices.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (currentPosition + 1) % enabledIndices.length
          : (currentPosition - 1 + enabledIndices.length) % enabledIndices.length;
    const nextIndex = enabledIndices[nextPosition];

    if (nextIndex === undefined) {
      return;
    }

    const nextOption = options[nextIndex];

    if (!nextOption) {
      return;
    }

    onValueChange(nextOption.value);
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      aria-label={ariaLabel}
      className={["ds-segmented-control", className].filter(Boolean).join(" ")}
      data-size={size}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const IconComponent = option.icon;
        const active = option.value === value;

        return (
          <button
            aria-checked={active}
            className="ds-segmented-control-option"
            data-active={active}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            role="radio"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {active ? <motion.span
              aria-hidden="true"
              className="ds-segmented-control-indicator"
              layoutId={reduced ? undefined : selectionId}
              transition={reduced ? reducedFadeTransition : fadeTransition}
            /> : null}
            {IconComponent ? (
              <IconComponent aria-hidden="true" size={16} />
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
