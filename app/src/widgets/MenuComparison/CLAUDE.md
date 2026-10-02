# app/src/widgets/MenuComparison/
> L2 | 父级: ../CLAUDE.md

成员清单
main.tsx: 独立iframe入口，复用生产侧栏表面、身份卡与共享样式，在相同账户数据/侧栏宽度下默认展开旧版或当前菜单；只使用内存状态，同源消息同步对比页控件和实际菜单尺寸，不挂载认证/路由或访问业务数据
PreviousUserMenu.tsx: 1c1fe55的历史菜单快照，仅重定向共享依赖和组件名；固定256px宽度、按内部身份按钮定位，保留原交互与数据展示，与当前生产UserMenu构成真实组件对照

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
