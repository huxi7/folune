/**
 * [INPUT]: 依赖 landing.css 的 14px/贴边 Divider、主内容内轨、可选全宽外轨与 10px SVG Pin 遮罩几何规则
 * [OUTPUT]: 对外提供正文止于主节点的水平线、fullBleed 穿过内收外节点并延伸至视口的水平线、不被导轨穿透的精密菱形节点与零高度贴边模式
 * [POS]: app/src/widgets 的蓝图区块分隔骨架，被 LandingPage 与 LandingSections 显式插入边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type BlueprintDividerProps = {
  flush?: boolean;
  fullBleed?: boolean;
};

function BlueprintPin({
  edge,
}: {
  edge: "edge-end" | "edge-start" | "end" | "start";
}) {
  return (
    <svg
      className={`blueprint-pin blueprint-pin-${edge}`}
      focusable="false"
      viewBox="0 0 10 10"
    >
      <path d="M5 .5 9.5 5 5 9.5 .5 5Z" />
    </svg>
  );
}

export function BlueprintDivider({
  flush = false,
  fullBleed = false,
}: BlueprintDividerProps) {
  return (
    <div
      aria-hidden="true"
      className="blueprint-divider"
      data-flush={flush || undefined}
      data-full-bleed={fullBleed || undefined}
    >
      <span className="blueprint-divider-line" />
      {fullBleed ? (
        <>
          <BlueprintPin edge="edge-start" />
          <BlueprintPin edge="edge-end" />
        </>
      ) : null}
      <BlueprintPin edge="start" />
      <BlueprintPin edge="end" />
    </div>
  );
}
