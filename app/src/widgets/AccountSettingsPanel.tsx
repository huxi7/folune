/**
 * [INPUT]: 依赖 ThemeProvider 的 system/light/dark 偏好，依赖 共享 Lucide 设备与明暗图标
 * [OUTPUT]: 对外提供 AccountDialog 内的单行外观面板，以 Design System SegmentedControl 切换系统、白天与黑夜模式
 * [POS]: app/src/widgets 的外观设置栏，只消费共享互斥选择原子件，不拥有局部材质；模态框生命周期和侧边导航由 AccountDialog 拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  DesktopIcon,
  MoonStarsIcon,
  SunIcon,
} from "../shared/design-system/icons";

import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../shared/design-system/components";
import { useTheme, type Theme } from "../shared/theme/ThemeProvider";

const themeOptions = [
  {
    icon: DesktopIcon,
    label: "系统",
    value: "system",
  },
  {
    icon: SunIcon,
    label: "白天",
    value: "light",
  },
  {
    icon: MoonStarsIcon,
    label: "黑夜",
    value: "dark",
  },
] satisfies Array<SegmentedControlOption<Theme>>;

export function AccountSettingsPanel() {
  const { setTheme, theme } = useTheme();

  return (
    <div className="settings-dialog-body">
      <section aria-labelledby="appearance-theme-title" className="appearance-dialog-section">
        <h4 className="account-dialog-section-title" id="appearance-theme-title">
          主题
        </h4>
        <SegmentedControl
          ariaLabel="界面主题"
          className="appearance-theme-control"
          onValueChange={setTheme}
          options={themeOptions}
          value={theme}
        />
      </section>
    </div>
  );
}
