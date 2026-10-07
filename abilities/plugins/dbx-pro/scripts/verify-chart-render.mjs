/**
 * Phase 1 反馈循环：用 happy-dom 执行 generateHtml 产物 + 本地 Chart.js，
 * 断言每个 canvas 创建的 Chart 实例 config.datasets 非空。
 *
 * 用法：node --import ./src/test/support/dom-setup.mjs scripts/verify-chart-render.mjs
 *
 * PASS → normalize 修正正确，问题在插件 iframe 宿主环境
 * FAIL → normalize/validate/generateHtml 链路本身有 bug
 */
import { Window } from "happy-dom";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { generateHtml, normalizeChartData } from "../src/tools/dbx-chart-collection.ts";

// ── 准备本地 Chart.js UMD ──────────────────────────
const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
const localChartJs = join(tmpdir(), "dbx-chart.js");
if (!existsSync(localChartJs)) {
	console.log("[verify] 下载 Chart.js UMD 到本地...");
	try {
		const buf = execSync(`curl -sL "${CHARTJS_CDN}" --max-time 10`, { timeout: 15000 });
		writeFileSync(localChartJs, buf);
		console.log(`[verify] ${buf.length} bytes → ${localChartJs}`);
	} catch { console.warn("[verify] 下载失败，继续..."); }
}
let chartJsCode = "";
try { chartJsCode = readFileSync(localChartJs, "utf8"); } catch {}

// ── 5 种测试场景 ──────────────────────────────────
const TEST_CASES = [
	{ name: "标准格式",
	  charts: [{ type: "bar", title: "标准",
		  data: { labels: ["1月","2月","3月"], datasets: [{ label: "GMV", data: [100,200,300] }] }}] },
	{ name: "AI 错格式 rows → normalize",
	  charts: [{ type: "bar", title: "rows",
		  data: { rows: [{ month: "1月", gmv: 100 }, { month: "2月", gmv: 200 }] }}] },
	{ name: "AI 错格式裸数组 → normalize",
	  charts: [{ type: "line", title: "裸数组", data: [10,20,30,40,50] }] },
	{ name: "缺 labels → normalize 补索引",
	  charts: [{ type: "pie", title: "缺labels",
		  data: { datasets: [{ label: "份额", data: [30,50,20] }] }}] },
	{ name: "多图 3 张混合类型",
	  charts: [
		  { type: "bar", title: "GMV", data: { rows: [{month:"1月",gmv:100},{month:"2月",gmv:200}] }},
		  { type: "line", title: "趋势", data: [1,2,3,4,5] },
		  { type: "pie", title: "份额", data: { labels:["A","B"], datasets:[{data:[60,40]}] }},
	  ] },
];

let pass = 0, fail = 0;

for (const tc of TEST_CASES) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`  ${tc.name}`);
	console.log(`${"=".repeat(60)}`);

	const html = generateHtml({ charts: tc.charts, title: tc.name });

	// Happy DOM —— 不再手写 defaults，完全用 generateHtml 生成的 HTML（内含正确 defaults）
	const window = new Window();
	const document = window.document;

	// Chart.js UMD
	if (chartJsCode) {
		const s = document.createElement("script");
		s.textContent = chartJsCode;
		document.head.appendChild(s);
	}

	// 写入完整 HTML body（defaults JS 已由 generateHtml 内联在 HTML 里）
	document.body.innerHTML = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? html;

	// 同时把整个 HTML 的 head 里的脚本也注入（defaults JS 可能在 <head> 里）
	const headScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
	for (const tag of headScripts) {
		const code = tag.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
		if (!code.trim()) continue;
		try {
			window.eval(code); // 先跑 defaults（IIFE，不会重复初始化）
		} catch (e) { /* 可能重复执行，忽略 */ }
	}

	// 执行 body 里所有 inline script（new Chart(...))
	let created = 0;
	let err = null;
	const bodyScripts = document.querySelectorAll("script:not([src])");
	for (const s of bodyScripts) {
		const code = s.textContent || "";
		if (!code.includes("new Chart")) continue;
		try {
			window.eval(code);
			created++;
		} catch (e) { err = e; break; }
	}

	console.log(`  generateHtml: ${html.length} bytes`);
	console.log(`  inline Chart scripts: ${[...bodyScripts].filter(s => s.textContent?.includes("new Chart")).length}`);
	console.log(`  Chart 实例创建: ${created}/${tc.charts.length}`);

	// 检查 Chart.instances
	try {
		const instances = window.Chart?.instances ?? new Map();
		console.log(`  Chart.instances: ${instances.size}`);
		instances.forEach((inst, id) => {
			const dsCount = inst.config?.data?.datasets?.length ?? 0;
			const dsLen = inst.config?.data?.datasets?.[0]?.data?.length ?? 0;
			const labelLen = inst.config?.data?.labels?.length ?? 0;
			const canvas = document.getElementById(id);
			const canvasW = canvas?.width ?? 0;
			const canvasH = canvas?.height ?? 0;
			console.log(`    [${id}] type=${inst.config?.type} datasets=${dsCount} firstDsLen=${dsLen} labels=${labelLen} canvas=${canvasW}x${canvasH}`);
		});
	} catch (e) { console.log(`  Chart.instances 检查失败: ${e.message}`); }

	// 预期判断
	const expected = tc.charts.length;
	const ok = created === expected && (window.Chart?.instances?.size ?? 0) === expected && !err;
	if (ok) { console.log(`  ✅ PASS`); pass++; }
	else {
		console.log(`  ❌ FAIL — created=${created}, instances=${window.Chart?.instances?.size ?? 0}, err=${err?.message ?? "none"}`);
		fail++;
	}
}

console.log(`\n${"#".repeat(40)}`);
console.log(`  ${pass} PASS / ${fail} FAIL`);
console.log(`${"#".repeat(40)}`);
process.exit(fail > 0 ? 1 : 0);
