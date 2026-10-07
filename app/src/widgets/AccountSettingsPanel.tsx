/**
 * [INPUT]: 依赖 ThemeProvider/LocaleProvider 的受控偏好与 DS Select/compact SegmentedControl
 * [OUTPUT]: 对外提供语言在前、外观在后的独立设置分组，保持双语即时切换
 * [POS]: widgets 的通用设置栏；语言使用下拉、主题使用无图标分段，尺寸由 account-center.css 按参考实测统一
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Select, SegmentedControl, type SegmentedControlOption } from "../shared/design-system/components";
import { useTheme, type Theme } from "../shared/theme/ThemeProvider";
import { isLocale, useLocale } from "../shared/locale";

export function AccountSettingsPanel() {
  const { setTheme, theme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const themeOptions = [
    { label: t("跟随系统", "System"), value: "system" },
    { label: t("白天", "Day"), value: "light" },
    { label: t("黑暗", "Night"), value: "dark" },
  ] satisfies Array<SegmentedControlOption<Theme>>;
  const languageOptions = [
    { label: "简体中文", value: "zh-CN" },
    { label: "English", value: "en" },
  ];

  return (
    <div className="settings-dialog-body">
      <section aria-labelledby="appearance-language-title" className="account-dialog-section account-language-section">
        <header className="account-dialog-section-header">
          <h4 className="account-dialog-section-title" id="appearance-language-title">{t("语言", "Language")}</h4>
          <p className="account-dialog-section-description">{t("选择 Folune 界面使用的语言。", "Choose the language used in Folune.")}</p>
        </header>
        <div className="account-dialog-rows">
          <div className="account-dialog-row account-language-row">
            <div className="account-dialog-row-copy">
              <p className="account-dialog-label">{t("语言", "Language")}</p>
              <p className="account-dialog-section-description">{locale === "en" ? "English" : "简体中文"}</p>
            </div>
            <Select ariaLabel={t("界面语言", "Language")} className="appearance-language-control" onValueChange={value => { if (isLocale(value)) setLocale(value); }} options={languageOptions} value={locale} />
          </div>
        </div>
      </section>
      <section aria-labelledby="appearance-theme-title" className="account-dialog-section">
        <header className="account-dialog-section-header">
          <h4 className="account-dialog-section-title" id="appearance-theme-title">{t("外观", "Appearance")}</h4>
          <p className="account-dialog-section-description">{t("调整当前设备上的界面明暗偏好。", "Adjust the appearance on this device.")}</p>
        </header>
        <div className="account-dialog-rows">
          <div className="account-dialog-row account-theme-row">
            <div className="account-dialog-row-copy">
              <p className="account-dialog-label">{t("主题", "Theme")}</p>
              <p className="account-dialog-section-description">{t("仅影响当前设备。", "Only applies to this device.")}</p>
            </div>
            <SegmentedControl size="compact" ariaLabel={t("界面主题", "Theme")} className="appearance-theme-control" onValueChange={setTheme} options={themeOptions} value={theme} />
          </div>
        </div>
      </section>
    </div>
  );
}
