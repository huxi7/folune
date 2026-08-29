/**
 * [INPUT]: 依赖 React 的受控状态、effect/id/ref 与键盘事件，依赖 共享 Lucide 图标，依赖 index.css 的 ds-select 组件类
 * [OUTPUT]: 对外提供具备 combobox/listbox ARIA 契约的 Select 组件及其选项、位置与触发器类型
 * [POS]: app/src/shared/design-system/components 的通用选择器基础件，被 AccountSettingsPanel 与 Design System 预览消费；UserMenu 已使用独立账户菜单语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CaretUpDownIcon,
  CheckIcon,
  type Icon,
} from "../icons";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { useDismissable } from "../useDismissable";

export type SelectOption = {
  description?: string;
  icon?: Icon;
  label: string;
  tone?: "default" | "danger";
  value: string;
};

export type SelectPlacement = "top" | "bottom";

export type SelectTriggerRenderProps = {
  activeOptionId?: string;
  listboxId: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  open: boolean;
  selectedOption?: SelectOption;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

type SelectProps = {
  ariaLabel: string;
  className?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placement?: SelectPlacement;
  renderTrigger?: (props: SelectTriggerRenderProps) => ReactNode;
  showSelection?: boolean;
  value?: string;
};

export function Select({
  ariaLabel,
  className = "",
  defaultValue,
  onValueChange,
  options,
  placement = "bottom",
  renderTrigger,
  showSelection = true,
  value,
}: SelectProps) {
  const listboxId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value);
  const [open, setOpen] = useState(false);
  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue],
  );

  const closeSelect = useCallback(() => setOpen(false), []);

  useDismissable({
    focusRef: triggerRef,
    onDismiss: closeSelect,
    open,
    shellRef,
  });

  function openSelect(nextIndex = selectedIndex) {
    setActiveIndex(nextIndex);
    setOpen(true);
    // Escape/方向键/Home/End 全部绑在 trigger 的 onKeyDown 上, 而 macOS 的
    // Safari/Firefox 点击 button 不赋予焦点 —— 不显式聚焦会让菜单打开后
    // 键盘完全失控, 只剩"点击外部"一条关闭路径。
    triggerRef.current?.focus();
  }

  function selectOption(option: SelectOption) {
    if (value === undefined) {
      setInternalValue(option.value);
    }
    onValueChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab" && open) {
      setOpen(false);
      return;
    }

    if (options.length === 0) {
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openSelect(event.key === "ArrowDown" ? selectedIndex : options.length - 1);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((currentIndex) =>
        (currentIndex + direction + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption) {
        selectOption(activeOption);
      }
    }
  }

  const triggerProps: SelectTriggerRenderProps = {
    activeOptionId: open ? `${listboxId}-option-${activeIndex}` : undefined,
    listboxId,
    onClick: () => (open ? setOpen(false) : openSelect()),
    onKeyDown: handleTriggerKeyDown,
    open,
    selectedOption,
    triggerRef,
  };

  return (
    <div className={["ds-select-shell", className].join(" ")} ref={shellRef}>
      {renderTrigger ? (
        renderTrigger(triggerProps)
      ) : (
        <button
          aria-activedescendant={triggerProps.activeOptionId}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className="ds-select-trigger"
          data-open={open}
          onClick={triggerProps.onClick}
          onKeyDown={handleTriggerKeyDown}
          ref={triggerRef}
          role="combobox"
          type="button"
        >
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium">
              {selectedOption?.label ?? ariaLabel}
            </span>
            {selectedOption?.description ? (
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {selectedOption.description}
              </span>
            ) : null}
          </span>
          <CaretUpDownIcon aria-hidden="true" size={16} />
        </button>
      )}

      {open ? (
        <div
          aria-label={ariaLabel}
          className={[
            "ds-select-menu",
            placement === "top" ? "ds-select-menu-top" : "ds-select-menu-bottom",
          ].join(" ")}
          id={listboxId}
          role="listbox"
        >
          {options.map((option, index) => {
            const IconComponent = option.icon;
            const isSelected = option.value === selectedValue;

            return (
              <button
                aria-selected={isSelected}
                className="ds-select-option"
                data-active={index === activeIndex}
                data-tone={option.tone ?? "default"}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                onClick={() => selectOption(option)}
                onPointerMove={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                {IconComponent ? (
                  <IconComponent aria-hidden="true" size={16} />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {showSelection && isSelected ? (
                  <CheckIcon aria-hidden="true" size={14} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
