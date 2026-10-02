/**
 * [INPUT]: 依赖真实 LocaleProvider/useLocale、账户设置/资料/安全面板、ThemeProvider、happy-dom 与 Bun test
 * [OUTPUT]: 验证中英切换和格式化、资料草稿保留、持久化恢复/跨窗口同步、存储异常降级及独立 Demo 无 Provider 的零副作用默认值
 * [POS]: locale 的状态与设置接线门禁；不以静态文案匹配替代真实切换，保护 Demo 的内存边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  Element: browserWindow.Element,
  Node: browserWindow.Node,
});
const { act, cleanup, fireEvent, render } = await import("@testing-library/react/pure");
const { useLocale, isLocale } = await import("./index");
const { LocaleProvider } = await import("./LocaleProvider");
const { ThemeProvider } = await import("../theme/ThemeProvider");
const { AccountSettingsPanel } = await import("../../widgets/AccountSettingsPanel");
const { AccountProfilePanel } = await import("../../widgets/AccountProfilePanel");
const { AccountSecurityPanel } = await import("../../widgets/AccountSecurityPanel");
const { ToastProvider } = await import("../design-system/components");
const { applyVisualContext } = await import("../theme/visualContext");

function Consumer() {
  const { locale, setLocale, t, formatDate, formatNumber } = useLocale();
  return <>
    <output data-testid="locale">{locale}</output>
    <output data-testid="copy">{t("设置", "Settings")}</output>
    <output data-testid="date">{formatDate("2026-10-01T00:00:00Z", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</output>
    <output data-testid="number">{formatNumber(1_234.56, { maximumFractionDigits: 1 })}</output>
    <output data-testid="invalid-date">{formatDate("invalid")}</output>
    <button onClick={() => setLocale("en")} type="button">English</button>
    <button onClick={() => setLocale("zh-CN")} type="button">简体中文</button>
  </>;
}

beforeEach(() => {
  browserWindow.localStorage.clear();
  browserWindow.document.documentElement.lang = "zh-CN";
  browserWindow.document.documentElement.dataset.visualContext = "app";
});
afterEach(cleanup);

describe("界面语言边界", () => {
  test("显式切换同步文案、日期、文档语言与持久化", () => {
    const view = render(<LocaleProvider><Consumer /></LocaleProvider>);
    expect(view.getByTestId("copy").textContent).toBe("设置");
    fireEvent.click(view.getByRole("button", { name: "English" }));
    expect(view.getByTestId("copy").textContent).toBe("Settings");
    expect(view.getByTestId("date").textContent).toBe("October 1, 2026");
    expect(view.getByTestId("number").textContent).toBe("1,234.6");
    expect(view.getByTestId("invalid-date").textContent).toBe("—");
    expect(browserWindow.document.documentElement.lang).toBe("en");
    expect(browserWindow.localStorage.getItem("folune-locale")).toBe("en");
    fireEvent.click(view.getByRole("button", { name: "简体中文" }));
    expect(view.getByTestId("date").textContent).toBe("2026年10月1日");
    expect(browserWindow.document.documentElement.lang).toBe("zh-CN");
  });

  test("重新装配恢复英文，非法旧值安全回退中文", () => {
    browserWindow.localStorage.setItem("folune-locale", "en");
    const english = render(<LocaleProvider><Consumer /></LocaleProvider>);
    expect(english.getByTestId("copy").textContent).toBe("Settings");
    english.unmount();
    browserWindow.localStorage.setItem("folune-locale", "es");
    const chinese = render(<LocaleProvider><Consumer /></LocaleProvider>);
    expect(chinese.getByTestId("copy").textContent).toBe("设置");
    expect(isLocale("es")).toBe(false);
  });

  test("公开中文页保持正确文档语言，返回工作区恢复英文偏好", () => {
    browserWindow.localStorage.setItem("folune-locale", "en");
    const view = render(<LocaleProvider><Consumer /></LocaleProvider>);
    const root = browserWindow.document.documentElement as unknown as HTMLElement;
    applyVisualContext("/", root);
    expect(root.lang).toBe("zh-CN");
    expect(view.getByTestId("locale").textContent).toBe("en");
    applyVisualContext("/app/notes/example", root);
    expect(root.lang).toBe("en");
    expect(browserWindow.localStorage.getItem("folune-locale")).toBe("en");
  });

  test("另一窗口更改或移除偏好同步当前会话，忽略其他存储键", () => {
    const view = render(<LocaleProvider><Consumer /></LocaleProvider>);
    act(() => browserWindow.dispatchEvent(new browserWindow.StorageEvent("storage", { key: "folune-locale", newValue: "en" })));
    expect(view.getByTestId("copy").textContent).toBe("Settings");
    act(() => browserWindow.dispatchEvent(new browserWindow.StorageEvent("storage", { key: "unrelated", newValue: "zh-CN" })));
    expect(view.getByTestId("copy").textContent).toBe("Settings");
    act(() => browserWindow.dispatchEvent(new browserWindow.StorageEvent("storage", { key: "folune-locale" })));
    expect(view.getByTestId("copy").textContent).toBe("设置");
  });

  test("存储禁用时仍允许本次会话切换", () => {
    const get = spyOn(browserWindow.localStorage, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const set = spyOn(browserWindow.localStorage, "setItem").mockImplementation(() => { throw new Error("denied"); });
    try {
      const view = render(<LocaleProvider><Consumer /></LocaleProvider>);
      fireEvent.click(view.getByRole("button", { name: "English" }));
      expect(view.getByTestId("copy").textContent).toBe("Settings");
      expect(browserWindow.document.documentElement.lang).toBe("en");
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  test("无 Provider 的 Demo 使用静态中文，不读写偏好或文档根", () => {
    browserWindow.document.documentElement.lang = "en";
    browserWindow.localStorage.setItem("folune-locale", "en");
    const get = spyOn(browserWindow.localStorage, "getItem");
    const set = spyOn(browserWindow.localStorage, "setItem");
    try {
      const view = render(<Consumer />);
      fireEvent.click(view.getByRole("button", { name: "English" }));
      expect(view.getByTestId("copy").textContent).toBe("设置");
      expect(get).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
      expect(browserWindow.document.documentElement.lang).toBe("en");
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  test("设置只有两种语言，切换后标签和外观选项一起翻译", () => {
    const view = render(<ThemeProvider><LocaleProvider><AccountSettingsPanel /></LocaleProvider></ThemeProvider>);
    fireEvent.click(view.getByRole("combobox", { name: "界面语言" }));
    expect(view.getAllByRole("option")).toHaveLength(2);
    fireEvent.click(view.getByRole("option", { name: "English" }));
    expect(view.getByRole("combobox", { name: "Language" }).textContent).toContain("English");
    expect(view.getByRole("radio", { name: "System" })).toBeDefined();
    expect(view.getByRole("radio", { name: "Day" })).toBeDefined();
    expect(view.getByRole("radio", { name: "Night" })).toBeDefined();
    fireEvent.click(view.getByRole("combobox", { name: "Language" }));
    fireEvent.click(view.getByRole("option", { name: "简体中文" }));
    expect(view.getByRole("combobox", { name: "界面语言" }).textContent).toContain("简体中文");
  });

  test("语言切换保留资料草稿和用户内容，账户日期一起切换", () => {
    const profile = { id: "example", username: "林", bio: "我的手记", email: "example@example.com", avatarUrl: null };
    const view = render(<LocaleProvider>
      <Consumer />
      <ToastProvider>
        <AccountProfilePanel profile={profile} onProfileChange={() => {}} />
        <AccountSecurityPanel profile={profile} createdAt="2026-07-05T08:00:00Z" onSignOut={async () => {}} />
      </ToastProvider>
    </LocaleProvider>);
    fireEvent.change(view.getByRole("textbox", { name: "个人简介" }), { target: { value: "尚未保存的手记" } });
    fireEvent.click(view.getByRole("button", { name: "English" }));
    expect((view.getByRole("textbox", { name: "Display name" }) as HTMLInputElement).value).toBe("林");
    expect((view.getByRole("textbox", { name: "About you" }) as HTMLTextAreaElement).value).toBe("尚未保存的手记");
    expect(view.getByText("July 5, 2026")).toBeDefined();
    expect(view.getByRole("button", { name: "Sign out" })).toBeDefined();
  });
});
