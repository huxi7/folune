/**
 * [INPUT]: 依赖 app 本地环境文件、@vitejs/plugin-react、@tailwindcss/vite 与 Vite 8 Rolldown chunk 输出能力
 * [OUTPUT]: 对外提供严格固定端口 10000、APP/Demo 双 HTML 构建与 CodeMirror Markdown/Language/Features 拆包策略
 * [POS]: app 根配置文件，连接 app 环境、Vite、React、Tailwind CSS v4，并约束开发入口与重型编辑器依赖边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 10000,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      input: { main: "index.html", demo: "demo.html" },
      output: {
        manualChunks(id) {
          if (
            id.includes("@codemirror/lang-markdown") ||
            id.includes("@lezer/markdown")
          ) {
            return "codemirror-markdown";
          }

          if (
            id.includes("@codemirror/language") ||
            id.includes("@lezer/common") ||
            id.includes("@lezer/lr") ||
            id.includes("@lezer/highlight")
          ) {
            return "codemirror-language";
          }

          if (
            id.includes("@uiw/codemirror-extensions-basic-setup") ||
            id.includes("@codemirror/autocomplete") ||
            id.includes("@codemirror/commands") ||
            id.includes("@codemirror/lint") ||
            id.includes("@codemirror/search") ||
            id.includes("@codemirror/theme-one-dark")
          ) {
            return "codemirror-features";
          }

          if (id.includes("@codemirror") || id.includes("@lezer")) {
            return "codemirror-languages";
          }
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
