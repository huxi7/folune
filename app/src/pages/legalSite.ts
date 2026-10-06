/**
 * [INPUT]: 依据运营者确认的公开身份与正式网站地址，不读取运行环境或用户数据
 * [OUTPUT]: 对外提供两份协议共同使用的运营者、网站、经确认的联系邮箱及版本日期
 * [POS]: pages 的法律身份事实源；正文和阅读页共读，独立于博客作者资料
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const legalSite = {
  operator: "huxi（Folune 独立开发者）",
  origin: "https://folune.huxi7.com",
  email: "oxygen777@2925.com",
  updatedAt: "2026-10-07",
};
