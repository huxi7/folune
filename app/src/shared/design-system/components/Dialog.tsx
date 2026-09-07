/**
 * [INPUT]: 依赖 Motion presence、Portal、useModalLifecycle 与 React id/ref，依赖 共享 Lucide XIcon，依赖 Button 与 design-system.css 暴露的 ds-dialog-overlay/ds-dialog-panel/ds-dialog-shell 模态材质类
 * [OUTPUT]: 对外提供密度/宽度/对齐/表面/标题、default|none 入退场模式、标题描述关联、Esc、焦点循环、滚动锁定的 Dialog
 * [POS]: app/src/shared/design-system/components 的唯一模态基础件；motion=none 交出入场编排让遮罩随 root 视图过渡一起换（遮罩绝不自带过渡身份，否则会盖住正在放大的纸），模态行为仍由此统一
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { XIcon } from "../icons";
import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion as m, useIsPresent, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { surfaceVariants } from "../motion";
import { useModalLifecycle } from "../useModalLifecycle";

import { Button } from "./Button";

type DialogProps = {
  /** top 让弹窗贴近视口上方，命令面板需要它才不会在长结果时上下跳 */
  align?: DialogAlign;
  children: ReactNode;
  density?: DialogDensity;
  description?: string;
  headerMode?: DialogHeaderMode;
  motion?: DialogMotion;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** bare 表面不提供任何弹窗外壳，只保留遮罩与模态行为，由 children 自己拥有视觉 */
  surface?: DialogSurface;
  title: string;
  width?: DialogWidth;
};

export type DialogAlign = "center" | "top";
export type DialogDensity = "compact" | "default";
export type DialogHeaderMode = "default" | "embedded";
export type DialogMotion = "default" | "none";
export type DialogSurface = "bare" | "panel";
export type DialogWidth = "account" | "command" | "default";

const subscribeClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function Dialog(props: DialogProps) {
  const client = useSyncExternalStore(subscribeClient, clientSnapshot, serverSnapshot);
  // 空的嵌套 Dialog 不注册父级退出：空 presence 没有子动画可回报完成。
  const content = (
    <AnimatePresence propagate={props.open}>
      {props.open ? <DialogFrame key="dialog" {...props} /> : null}
    </AnimatePresence>
  );
  return client ? createPortal(content, document.body) : content;
}

function DialogFrame({
  align = "center",
  children,
  density = "default",
  description,
  headerMode = "default",
  motion = "default",
  onOpenChange,
  surface = "panel",
  title,
  width = "default",
}: DialogProps) {
  // bare 表面没有可见外壳, 可见标题栏在其中没有意义, 统一收敛为读屏可用的隐式标题。
  const resolvedHeaderMode = surface === "bare" ? "embedded" : headerMode;
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const reduced = Boolean(useReducedMotion());
  useModalLifecycle(panelRef, present, () => onOpenChange(false));

  return (
    <m.div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal={present ? true : undefined}
      aria-hidden={!present}
      inert={!present}
      className="ds-dialog-overlay fixed inset-0 flex justify-center p-4"
      data-align={align}
      data-motion={motion}
      data-surface={surface}
      role={present ? "dialog" : undefined}
      initial={motion === "none" ? false : "hidden"}
      animate="visible"
      exit={motion === "none" ? undefined : "exit"}
      variants={motion === "none" ? undefined : surfaceVariants("fade", reduced)}
    >
      <button
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        type="button"
      />
      <m.div
        initial={motion === "none" ? false : "hidden"}
        animate="visible"
        exit={motion === "none" ? undefined : "exit"}
        variants={motion === "none" ? undefined : surfaceVariants("modal", reduced)}
        className={[
          "relative z-10",
          surface === "bare" ? "ds-dialog-shell" : "ds-dialog-panel",
          ...(surface === "bare" ? [] : [
            width === "account"
              ? "account-dialog-panel"
              : width === "command"
                ? "command-palette-panel"
                : "w-full max-w-lg",
            resolvedHeaderMode === "embedded"
              ? "p-0"
              : density === "compact"
                ? "p-4"
                : "p-5",
          ]),
        ].join(" ")}
        data-density={density}
        data-surface={surface}
        data-width={width}
        ref={panelRef}
        tabIndex={-1}
      >
        {resolvedHeaderMode === "embedded" ? (
          <div className="sr-only">
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p id={descriptionId}>{description}</p>
            ) : null}
          </div>
        ) : (
          <div
            className={density === "compact"
              ? "flex items-start justify-between gap-3"
              : "flex items-start justify-between gap-4"}
          >
            <div>
              <h2
                className={density === "compact"
                  ? "text-base font-semibold leading-tight text-foreground"
                  : "text-xl font-semibold leading-tight text-foreground"}
                id={titleId}
              >
                {title}
              </h2>
              {description ? (
                <p
                  className={density === "compact"
                    ? "mt-1.5 text-xs leading-5 text-muted-foreground"
                    : "mt-3 text-sm leading-6 text-muted-foreground"}
                  id={descriptionId}
                >
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="关闭弹窗"
              icon={XIcon}
              onClick={() => onOpenChange(false)}
              size="square"
              title="关闭"
              variant="ghost"
            />
          </div>
        )}
        {children}
      </m.div>
    </m.div>
  );
}
