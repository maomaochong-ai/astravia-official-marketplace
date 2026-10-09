/**
 * Phase 1 反馈循环：用 happy-dom 执行 generateHtml 产物 + 本地 Chart.js，
 * 断言每个 canvas 创建的 Chart 实例 config.datasets 非空。
 *
 * 用法：node --import ./src/test/support/dom-setup.mjs scripts/verify-chart-render.mjs
 *
 * PASS → normalize 修正正确，问题在插件 iframe 宿主环境
 * FAIL → normalize/validate/generateHtml 链路本身有 bug
 *
 * 最后一段是「独立文件」验证：内联运行时后的产物，不注入任何外部库也要能渲染。
 */
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { generateHtml, normalizeChartData } from "../src/tools/dbx-chart-collection.ts";
import { withEmbeddedChartJs } from "../src/shared/utils/chart-runtime.ts";

// ── 本地 Chart.js UMD（与产物内联的是同一份，无需联网）────
const localChartJs = new URL("../src/shared/vendor/chart.umd.js", import.meta.url);
let chartJsCode = "";
try { chartJsCode = readFileSync(localChartJs, "utf8"); }
catch (e) { console.warn(`[verify] 读取 vendor/chart.umd.js 失败: ${e.message}`); }

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

/**
 * 产物里已注册的 Chart 实例。
 * Chart.js v4 的 `Chart.instances` 是以 id 为键的对象；happy-dom 无 2D 上下文，
 * 但实例仍会注册，因此「每个图表一个实例且 datasets 非空」就是可用的回归信号。
 */
function chartInstances(window) {
	const instances = window.Chart?.instances;
	return instances && typeof instances === "object" ? Object.entries(instances) : [];
}

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
		if (!code.trim() || code.includes("new Chart")) continue; // 只跑 defaults，图表初始化交给下面的循环，避免重复计数
		try {
			window.eval(code);
		} catch (e) { /* 可能重复执行，忽略 */ }
	}

	// 执行 body 里所有 inline script（new Chart(...))
	let err = null;
	const bodyScripts = document.querySelectorAll("script:not([src])");
	for (const s of bodyScripts) {
		const code = s.textContent || "";
		if (!code.includes("new Chart")) continue;
		try {
			window.eval(code);
		} catch (e) { err = e; break; }
	}

	const instances = chartInstances(window);
	const expected = tc.charts.length;
	const withData = instances.filter(([, inst]) => (inst.config?.data?.datasets?.length ?? 0) > 0).length;
	console.log(`  generateHtml: ${html.length} bytes`);
	console.log(`  inline Chart scripts: ${[...bodyScripts].filter((s) => s.textContent?.includes("new Chart")).length}`);
	for (const [id, inst] of instances) {
		const dsCount = inst.config?.data?.datasets?.length ?? 0;
		const dsLen = inst.config?.data?.datasets?.[0]?.data?.length ?? 0;
		console.log(`    [${id}] type=${inst.config?.type} datasets=${dsCount} firstDsLen=${dsLen}`);
	}
	console.log(`  Chart 实例: ${instances.length}/${expected}（其中 datasets 非空 ${withData}）`);

	// 预期判断：每个图表都有实例，且实例都拿到了数据
	const ok = instances.length === expected && withData === expected && !err;
	if (ok) { console.log(`  ✅ PASS`); pass++; }
	else {
		console.log(`  ❌ FAIL — 实例=${instances.length}/${expected}, 非空数据=${withData}, err=${err?.message ?? "none"}`);
		fail++;
	}
}

// ── 独立文件验证：内联运行时后，不注入外部库也要能渲染 ──
console.log("\n" + "#".repeat(40));
console.log("  独立 HTML（内联 Chart.js）—— 不注入外部库");
console.log("#".repeat(40));
let saPass = 0;
let saFail = 0;

for (const tc of TEST_CASES) {
	const standalone = withEmbeddedChartJs(generateHtml({ charts: tc.charts, title: tc.name }));
	const window = new Window();
	const document = window.document;
	document.body.innerHTML = standalone.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";

	// 按文档顺序执行内联脚本（先 UMD、后 defaults + new Chart）
	const scripts = standalone.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) ?? [];
	let err = null;
	for (const tag of scripts) {
		const code = tag.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
		try { window.eval(code); } catch (e) { err = e; break; }
	}

	const instances = chartInstances(window);
	const withData = instances.filter(([, inst]) => (inst.config?.data?.datasets?.length ?? 0) > 0).length;
	const cdnLeft = standalone.includes("cdn.jsdelivr.net");
	const ok = instances.length === tc.charts.length && withData === tc.charts.length && !cdnLeft && !err;
	console.log("  " + tc.name + ": scripts=" + scripts.length + " 实例=" + instances.length + "/" + tc.charts.length + " cdn=" + cdnLeft + " err=" + (err?.message ?? "none"));
	if (ok) { console.log("  ✅ PASS"); saPass++; }
	else { console.log("  ❌ FAIL"); saFail++; }
}

console.log("\n" + "#".repeat(40));
console.log("  注入库: " + pass + " PASS / " + fail + " FAIL");
console.log("  独立文件: " + saPass + " PASS / " + saFail + " FAIL");
console.log("#".repeat(40));
process.exit(fail + saFail > 0 ? 1 : 0);