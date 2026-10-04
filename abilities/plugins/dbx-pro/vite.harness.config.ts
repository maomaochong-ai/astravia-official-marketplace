// 临时：浏览器验证夹具，不进入发布包，验证后删除。
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	server: {
		port: 5199,
		strictPort: true,
		// 夹具对接真实引擎（node server/main.mjs --port 8899）。
		proxy: {
			"/engine-api": {
				target: "http://127.0.0.1:8899",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/engine-api/, ""),
			},
		},
	},
	esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
