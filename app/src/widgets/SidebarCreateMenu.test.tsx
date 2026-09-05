/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与真实 SidebarCreateMenu
 * [OUTPUT]: 锁定 48/32 split 的文字主动作、恰好两项菜单及方向键/Home/End/Escape 焦点合同
 * [POS]: widgets 的侧栏创建入口回归门禁；只验证视图与键盘意图，不触碰树事务或路由
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  KeyboardEvent: browserWindow.KeyboardEvent,
  Node: browserWindow.Node,
  PointerEvent: browserWindow.PointerEvent,
  window: browserWindow,
});

const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { SidebarCreateMenu } = await import("./SidebarCreateMenu");

afterEach(cleanup);

function renderMenu() {
  const onCreateCanvas = mock(() => undefined);
  const onCreateFolder = mock(() => undefined);
  const onCreateMemo = mock(() => undefined);
  const view = render(
    <SidebarCreateMenu
      disabled={false}
      onCreateCanvas={onCreateCanvas}
      onCreateFolder={onCreateFolder}
      onCreateMemo={onCreateMemo}
    />,
  );
  return { ...view, onCreateCanvas, onCreateFolder, onCreateMemo };
}

describe("SidebarCreateMenu", () => {
  test("主区只显示新建文字并继续直接创建 memo", () => {
    const view = renderMenu();
    const main = view.getByRole("button", { name: "新建备忘录" });
    expect(main.textContent?.trim()).toBe("新建");
    expect(main.querySelector("svg")).toBeNull();
    fireEvent.click(main);
    expect(view.onCreateMemo).toHaveBeenCalledTimes(1);
  });

  test("菜单恰好两项，方向键与 Home/End 按实际项循环", async () => {
    const view = renderMenu();
    fireEvent.click(view.getByRole("button", { name: "选择新建类型" }));
    const items = view.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent?.trim()))
      .toEqual(["新建 Canvas", "新建文件夹"]);
    const [canvasItem, folderItem] = items;
    if (canvasItem === undefined || folderItem === undefined) {
      throw new Error("新建菜单必须恰好渲染 Canvas 与文件夹两项");
    }
    await waitFor(() => expect(document.activeElement).toBe(canvasItem));
    fireEvent.keyDown(canvasItem, { key: "End" });
    expect(document.activeElement).toBe(folderItem);
    fireEvent.keyDown(folderItem, { key: "ArrowDown" });
    expect(document.activeElement).toBe(canvasItem);
    fireEvent.keyDown(canvasItem, { key: "ArrowUp" });
    expect(document.activeElement).toBe(folderItem);
    fireEvent.keyDown(folderItem, { key: "Home" });
    expect(document.activeElement).toBe(canvasItem);
  });

  test("Escape 关闭菜单并把焦点还给下拉触发器", async () => {
    const view = renderMenu();
    const trigger = view.getByRole("button", { name: "选择新建类型" });
    fireEvent.click(trigger);
    await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
    fireEvent.keyDown(view.getByRole("menuitem", { name: "新建 Canvas" }), {
      key: "Escape",
    });
    await waitFor(() => expect(view.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
