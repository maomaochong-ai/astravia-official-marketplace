/**
 * 启动列的居中，用真几何证明，而不是读 CSS 文本。
 *
 * 背景：0.6.2 给列加了 `min-height: 100%`，子项与容器等高 → 自由空间 0 → `margin:auto`
 * 无处可分配，内容贴顶、下方一片空白（用户截图）。jsdom 没有布局，这条缺陷只能靠真实
 * 引擎量出来，所以这里用系统 Chrome 走 CDP，直接读 boundingBox。
 *
 * 运行：node tests/browser/launch-centering.mjs
 * 依赖：本机 chrome / edge 任一（找不到就 skip，不冒充通过）
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "../..");
const cssPath = join(plugin, "dist/style.css");
if (!existsSync(cssPath)) {
	console.log("skip: run `npm run build` first (no dist/style.css)");
	process.exit(0);
}

const CANDIDATES = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
];
const chrome = CANDIDATES.find((candidate) => existsSync(candidate));
if (!chrome) {
	console.log("skip: no Chrome/Edge on this machine");
	process.exit(0);
}

// Chrome 的 headless 截图/求值需要 DevTools 协议；用 CDP 的最小客户端比拉 Playwright 便宜。
const css = readFileSync(cssPath, "utf8");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body style="margin:0">
<div data-astravia-plugin-root="strix" style="height:900px;width:1200px;display:flex">
  <div class="astra-strix-term astra-strix-launch-surface">
    <div class="astra-strix-launch">
      <div class="astra-strix-launch-head">
        <pre class="astra-strix-wordmark">███████╗████████╗██████╗ ██╗██╗  ██╗</pre>
        <p class="astra-strix-tagline">tagline</p>
      </div>
      <div class="astra-strix-prompt">
        <div class="astra-strix-prompt-row"><span class="astra-strix-prompt-caret">&gt;</span>
          <textarea class="astra-strix-prompt-input" rows="3"></textarea></div>
        <p class="astra-strix-meta"><span class="astra-strix-meta-name">free</span></p>
      </div>
      <div class="astra-strix-hints"><span class="astra-strix-key">enter</span></div>
      <p class="astra-strix-boot">ready</p>
    </div>
  </div>
</div></body></html>`;
const page = join(tmpdir(), "strix-launch-centering.html");
writeFileSync(page, html);

const PORT = 9333;
const child = execFileSync;
void child;
const { spawn } = await import("node:child_process");
const browser = spawn(
	chrome,
	[
		"--headless=new",
		`--remote-debugging-port=${PORT}`,
		"--user-data-dir=" + join(tmpdir(), "strix-cdp-profile"),
		"--no-first-run",
		"--no-default-browser-check",
		"--window-size=1200,900",
		pathToFileURL(page).href,
	],
	{ stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
	for (let i = 0; i < 60; i += 1) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
			const target = list.find((t) => t.type === "page");
			if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
		} catch {
			/* not listening yet */
		}
		await sleep(250);
	}
	throw new Error("CDP never came up");
}

const ws = new WebSocket(await cdpTarget());
await new Promise((resolveOpen) => ws.addEventListener("open", resolveOpen, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
	const msg = JSON.parse(event.data);
	const waiter = pending.get(msg.id);
	if (waiter) {
		pending.delete(msg.id);
		waiter(msg);
	}
});
const send = (method, params) =>
	new Promise((resolveSend) => {
		const id = (seq += 1);
		pending.set(id, resolveSend);
		ws.send(JSON.stringify({ id, method, params }));
	});
const evaluate = async (expression) => {
	const reply = await send("Runtime.evaluate", { expression, returnByValue: true });
	return reply.result?.result?.value;
};

await send("Runtime.enable");
await sleep(300);

const result = await evaluate(`(() => {
	const surface = document.querySelector('.astra-strix-launch-surface').getBoundingClientRect();
	const column = document.querySelector('.astra-strix-launch').getBoundingClientRect();
	return {
		topGap: Math.round(column.top - surface.top),
		bottomGap: Math.round(surface.bottom - column.bottom),
		leftGap: Math.round(column.left - surface.left),
		rightGap: Math.round(surface.right - column.right),
	};
})()`);

const vertical = Math.abs(result.topGap - result.bottomGap) <= 2;
const horizontal = Math.abs(result.leftGap - result.rightGap) <= 2;
console.log(JSON.stringify(result));
ws.close();
browser.kill();
if (!vertical || !horizontal) {
	console.error("launch column is not centred in a real engine");
	process.exit(1);
}
console.log("launch column centred (real engine)");
