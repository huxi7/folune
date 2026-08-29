/**
 * [INPUT]: 依赖 process.env 与 bun test 的 preload 时机（bunfig.toml 的 [test] preload）
 * [OUTPUT]: 对外提供测试期浏览器公开配置的唯一兜底：VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY
 * [POS]: app/src 的测试环境边界，与 main.tsx 并列但只服务 bun test；产品代码永不导入它
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/*
 * bun test 会把 NODE_ENV 设为 test, 而 Bun 在 test 环境下不读 .env.local, 因此
 * 真实开发配置对测试不可见, shared/supabase/client.ts 会在模块加载期直接抛错。
 * 从前靠个别测试文件各自写一份假值兜底, 于是"绿不绿"取决于文件执行顺序: 先跑到
 * 那两个文件才全绿, 反之整批 renderToString 测试连带炸在半个 window 上。
 *
 * 占位地址必须是立刻拒绝连接的回环地址。换成 example.supabase.co 这类可解析域名,
 * supabase-js 的会话请求会真的去做 DNS/TLS 而挂住, Command Palette 的键盘测试就会
 * 撞上 5s 超时——那是假红, 与被测代码无关。
 *
 * 这里是唯一的兜底点, 只补公开占位值, 已有真实值(CI 或显式注入)一律不覆盖。
 */
process.env.VITE_SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
