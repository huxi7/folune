/**
 * [INPUT]: 依赖 React 的受控状态、effect/id/ref 与键盘事件，依赖 共享 Lucide 图标，依赖 index.css 的 ds-select 组件类
 * [OUTPUT]: 对外提供 Select 组件、SelectOption、SelectPlacement 与 SelectTriggerRenderProps 类型
 * [POS]: app/src/shared/design-system/components 的通用选择器基础件，被 AccountSettingsPanel 与 Design System 预览消费；UserMenu 已使用独立账户菜单语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CaretUpDownIcon,
  CheckIcon,
  type Icon,
} from "../icons";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";

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

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openSelect(nextIndex = selectedIndex) {
    setActiveIndex(nextIndex);
    setOpen(true);
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
                  <IconComponent aria-hidden="true" size={17} />
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
                  <CheckIcon aria-hidden="true" size={15} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
