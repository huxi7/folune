/**
 * [INPUT]: 依赖 @supabase/supabase-js 的 createClient，依赖 Vite 注入的 Supabase URL 与 Publishable key
 * [OUTPUT]: 对外提供启用 PKCE、持久会话与自动刷新能力的 supabase 浏览器单例
 * [POS]: app/src/shared/supabase 的基础设施入口，被 auth 服务与路由守卫消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "缺少 Supabase 环境变量，请配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。",
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    persistSession: true,
  },
});
