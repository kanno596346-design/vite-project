import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // SEOトップ
        main: resolve(__dirname, "index.html"),
        // ゲーム本体
        poker: resolve(__dirname, "poker/index.html"),
        // 日本語トップ（作っている場合）
        ja: resolve(__dirname, "ja/index.html"),
      },
    },
  },
});
