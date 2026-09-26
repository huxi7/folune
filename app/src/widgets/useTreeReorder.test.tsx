/**
 * [INPUT]: 依赖 happy-dom、真实 React Hook、可控 WAAPI 时钟与尺寸回执
 * [OUTPUT]: 验证滚动/Panel 位移不污染树位移、连续插入接续当前帧、选中行保留淡入、ID 对账不重播、减少动态和运动租约回收
 * [POS]: 文件树结构动效的行为回归；只核对布局计算与生命周期，不替代用户视觉验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { useLayoutEffect, useRef } from "react";
import { treeFlipDurationMs, treeFlipEase } from "../pages/workspaceMotion";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
});
const { act, cleanup, render } = await import("@testing-library/react/pure");
const { useTreeReorder } = await import("./useTreeReorder");
const { isArchiveMotionActive } = await import("./archiveCordMotion");

let reduced = false;
let treeTop = 80;
let resize: (() => void) | undefined;
type AnimationRecord = {
  row: HTMLElement; frames: Keyframe[]; currentTime: number;
  finished: Promise<void>; cancel: () => void; finish: () => void;
};
let records: AnimationRecord[] = [];
const active = new Map<HTMLElement, AnimationRecord>();
window.matchMedia = ((query: string) => ({ matches: reduced, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
})) as typeof window.matchMedia;
Object.assign(globalThis, { ResizeObserver: class {
  constructor(callback: () => void) { resize = callback; }
  observe() {}
  disconnect() {}
} });

browserWindow.HTMLElement.prototype.getBoundingClientRect = function () {
  const row = this as unknown as HTMLElement;
  const tree = row.closest<HTMLDivElement>("[data-tree]");
  let top = treeTop;
  const animation = active.get(row);
  if (row.hasAttribute("data-memo-tree-row-id")) {
    top += Number(row.dataset["top"]) - (tree?.scrollTop ?? 0);
    if (animation) {
      const transform = String(animation.frames[0]?.transform);
      const y = Number(/translate\([^,]+, ([-\d.]+)px\)/.exec(transform)?.[1] ?? 0);
      top += y * (1 - treeFlipEase(animation.currentTime / treeFlipDurationMs));
    }
  }
  return new browserWindow.DOMRect(0, top, 240, 32);
};
Object.defineProperty(browserWindow.HTMLElement.prototype, "animate", { configurable: true, value: function (frames: Keyframe[]) {
  const row = this as HTMLElement;
  let resolve!: () => void;
  const finished = new Promise<void>((done) => { resolve = done; });
  const end = () => { if (active.get(row) === record) active.delete(row); resolve(); };
  const record: AnimationRecord = { row, frames, currentTime: 0, finished, cancel: end,
    finish: () => { record.currentTime = treeFlipDurationMs; end(); } };
  records.push(record);
  active.set(row, record);
  return record;
} });

type Row = { id: string; key?: string; top: number; hidden?: boolean; selected?: boolean };
let capture: () => void;
function Harness({ rows, layoutKey }: { rows: Row[]; layoutKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const capturePositions = useTreeReorder(ref, layoutKey);
  useLayoutEffect(() => { capture = capturePositions; }, [capturePositions]);
  return <div data-tree ref={ref}><div className="memo-tree-level">
    {rows.map((row) => <div key={row.key ?? row.id} inert={row.hidden}>
      <button aria-current={row.selected ? "page" : undefined} data-memo-tree-row-id={row.id} data-top={row.top} type="button">{row.id}</button>
    </div>)}
  </div></div>;
}
const oldRows: Row[] = [{ id: "a", top: 0 }, { id: "b", top: 32 }];
const inserted: Row[] = [{ id: "new", top: 0 }, { id: "a", top: 32 }, { id: "b", top: 64 }];
const firstFrame = (id: string) => records.findLast((record) => record.row.dataset["memoTreeRowId"] === id)?.frames[0];
beforeEach(() => { reduced = false; treeTop = 80; records = []; active.clear(); });
afterEach(() => { cleanup(); expect(isArchiveMotionActive()).toBe(false); });

describe("文件树原位插入", () => {
  test("最新行立即拥有选中语义，同时保留完整淡入与旧行让位", () => {
    const view = render(<Harness rows={oldRows} layoutKey="0" />);
    view.rerender(<Harness rows={inserted.map((row) => ({ ...row, selected: row.id === "new" }))} layoutKey="1" />);
    expect(firstFrame("new")?.opacity).toBe(0);
    expect(firstFrame("a")?.transform).toBe("translate(0px, -32px)");
    expect(view.getByRole("button", { name: "new" }).getAttribute("aria-current")).toBe("page");
  });

  test("滚动并移动 Panel 后新增一行，旧行只让出一行高度", () => {
    const view = render(<Harness rows={oldRows} layoutKey="before" />);
    const tree = view.container.querySelector<HTMLDivElement>("[data-tree]")!;
    tree.scrollTop = 160;
    treeTop = 120;
    view.rerender(<Harness rows={inserted} layoutKey="after" />);
    expect(firstFrame("a")?.transform).toBe("translate(0px, -32px)");
    expect(firstFrame("b")?.transform).toBe("translate(0px, -32px)");
    expect(firstFrame("new")?.opacity).toBe(0);
  });

  test("快速连续插入从当前帧接续，ResizeObserver 不把中途位置当终态", () => {
    const view = render(<Harness rows={oldRows} layoutKey="0" />);
    view.rerender(<Harness rows={inserted} layoutKey="1" />);
    records.forEach((record) => { record.currentTime = treeFlipDurationMs / 2; });
    resize?.();
    const remaining = 1 - treeFlipEase(0.5);
    view.rerender(<Harness rows={[{ id: "next", top: 0 }, ...inserted.map((row) => ({ ...row, top: row.top + 32 }))]} layoutKey="2" />);
    expect(firstFrame("a")?.transform).toBe(`translate(0px, ${-32 - 32 * remaining}px)`);
    expect(firstFrame("new")?.opacity).toBeCloseTo(1 - remaining);
  });

  test("显式手势快照只计一次在途 transform", () => {
    const view = render(<Harness rows={oldRows} layoutKey="0" />);
    view.rerender(<Harness rows={inserted} layoutKey="1" />);
    records.forEach((record) => { record.currentTime = treeFlipDurationMs / 2; });
    capture();
    view.rerender(<Harness rows={[{ id: "next", top: 0 }, ...inserted.map((row) => ({ ...row, top: row.top + 32 }))]} layoutKey="2" />);
    const y = Number(/, ([-\d.]+)px/.exec(String(firstFrame("a")?.transform))?.[1]);
    expect(y).toBeCloseTo(-32 - 32 * (1 - treeFlipEase(0.5)));
  });

  test("临时 ID 原位对账不重播；下一次插入仍把该行当作旧行", async () => {
    const view = render(<Harness rows={oldRows} layoutKey="0" />);
    view.rerender(<Harness rows={inserted} layoutKey="1" />);
    await act(async () => { records.forEach((record) => record.finish()); });
    expect(isArchiveMotionActive()).toBe(false);
    const count = records.length;
    const serverRows = inserted.map((row) => row.id === "new" ? { ...row, key: "new", id: "server" } : row);
    view.rerender(<Harness rows={serverRows} layoutKey="1" />);
    expect(records).toHaveLength(count);
    view.rerender(<Harness rows={[{ id: "next", top: 0 }, ...serverRows.map((row) => ({ ...row, top: row.top + 32 }))]} layoutKey="2" />);
    expect(firstFrame("server")?.opacity).toBe(1);
    expect(firstFrame("server")?.transform).toBe("translate(0px, -32px)");
  });

  test("初始挂载和减少动态不播放结构动画", () => {
    const view = render(<Harness rows={oldRows} layoutKey="0" />);
    expect(records).toHaveLength(0);
    reduced = true;
    view.rerender(<Harness rows={inserted} layoutKey="1" />);
    expect(records).toHaveLength(0);
  });

  test("折叠分支的行不参与结构动画", () => {
    const view = render(<Harness rows={[...oldRows, { id: "hidden", top: 0, hidden: true }]} layoutKey="0" />);
    view.rerender(<Harness rows={[...inserted, { id: "hidden", top: 120, hidden: true }]} layoutKey="1" />);
    expect(firstFrame("hidden")).toBeUndefined();
  });
});
