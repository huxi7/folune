/**
 * [INPUT]: 依赖 landing.css 的共享导轨坐标、分隔线中心与 8px 白填充 SVG 节点规则
 * [OUTPUT]: 提供 BlueprintPin 共享菱形、14px 双边分隔带、7px 内部分隔带与零高度贴边线；节点中心与线中心共轴，showPins 可关闭节点而保留线的位置和宽度
 * [POS]: widgets 的 Landing 横向骨架；导航、公告、正文与页脚复用，同一条边只绘制一次
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type BlueprintDividerProps = {
  compact?: boolean;
  flush?: boolean;
  fullBleed?: boolean;
  showPins?: boolean;
};

export function BlueprintPin({
  edge,
}: {
  edge: "edge-end" | "edge-start" | "end" | "start";
}) {
  return (
    <svg className={`blueprint-pin blueprint-pin-${edge}`} focusable="false" viewBox="0 0 10 10">
      <path d="M5 .5 9.5 5 5 9.5 .5 5Z" />
    </svg>
  );
}

export function BlueprintDivider({
  compact = false,
  flush = false,
  fullBleed = false,
  showPins = true,
}: BlueprintDividerProps) {
  return (
    <div
      aria-hidden="true"
      className="blueprint-divider"
      data-compact={compact || undefined}
      data-flush={flush || undefined}
      data-full-bleed={fullBleed || undefined}
    >
      {(flush ? ["start"] : ["start", "end"]).map((side) => (
        <div className="blueprint-divider-rule" data-side={side} key={side}>
          <span className="blueprint-divider-line" />
          {!compact && showPins ? (
            <>
              {fullBleed ? (
                <>
                  <BlueprintPin edge="edge-start" />
                  <BlueprintPin edge="edge-end" />
                </>
              ) : null}
              <BlueprintPin edge="start" />
              <BlueprintPin edge="end" />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
