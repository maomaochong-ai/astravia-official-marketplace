// 临时：浏览器验证夹具，不进入发布包，验证后删除。
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	server: { port: 5199, strictPort: true },
	esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
