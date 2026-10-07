/**
 * 看板/大屏 HTML shell 模板 —— iframe srcDoc 用。
 *
 * 两套主题：
 *   dashboard — 浅 QuickBI 风（对标宿主 ChartCard rounded-xl / 柔和边框）
 *   screen    — 深 DataV 风（渐变背景 + 圆角 + 青蓝主题色）
 *
 * 每个模板暴露为函数，接收 title / isScreen / cssVars 返回完整 HTML shell
 * （不含 </script></body></html> 尾巴，调用方再拼 JS）。
 *
 * 注意：iframe 无法继承宿主 CSS variables（--border, --background 等），
 * 所以主题颜色用硬编码值。如果将来要支持宿主主题动态切换，
 * 需要宿主在调用 dbx_chart_collection 时传 theme 参数。
 */

/** 生成看板/大屏的内联 CSS（根据主题）。 */
export function buildShellCss(isScreen: boolean): string {
	if (isScreen) {
		return `
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#0c0c0c 0%,#1a1a2e 100%);color:#e2e8f0;min-height:100vh;padding:clamp(16px,3vw,32px);}
.header{text-align:center;margin-bottom:clamp(16px,3vw,32px);}
.header h1{font-size:clamp(20px,3vw,32px);margin-bottom:8px;background:linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600;letter-spacing:-0.5px;}
.header p{font-size:clamp(12px,1.5vw,14px);color:#64748b;}
.grid{display:grid;gap:clamp(12px,2vw,20px);max-width:1800px;margin:0 auto;}
@media(max-width:768px){.grid{grid-template-columns:1fr;}}
.chart-card{background:rgba(255,255,255,0.04);backdrop-filter:blur(12px);border:1px solid rgba(6,182,212,0.25);box-shadow:0 0 24px rgba(6,182,212,0.12);border-radius:4px;padding:clamp(12px,2vw,20px);overflow:hidden;transition:transform .2s,box-shadow .2s;animation:fadeIn .5s ease-out forwards;opacity:0;}
.chart-card:hover{box-shadow:0 0 32px rgba(6,182,212,0.2);}
.chart-card h3{font-size:clamp(12px,1.5vw,14px);margin-bottom:8px;color:#a5f3fc;font-weight:600;letter-spacing:.3px;}
.chart-desc{font-size:11px;color:#94a3b8;margin-bottom:6px;}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.chart-card:nth-child(1){animation-delay:.1s}.chart-card:nth-child(2){animation-delay:.2s}.chart-card:nth-child(3){animation-delay:.3s}
.chart-card:nth-child(4){animation-delay:.4s}.chart-card:nth-child(5){animation-delay:.5s}.chart-card:nth-child(6){animation-delay:.6s}`;
	}
	return `
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#f8fafc;color:#111827;min-height:100vh;padding:clamp(16px,3vw,32px);}
.header{text-align:center;margin-bottom:clamp(16px,3vw,32px);}
.header h1{font-size:clamp(20px,3vw,32px);margin-bottom:8px;background:linear-gradient(90deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600;letter-spacing:-0.5px;}
.header p{font-size:clamp(12px,1.5vw,14px);color:#6b7280;}
.grid{display:grid;gap:clamp(12px,2vw,20px);max-width:1600px;margin:0 auto;}
@media(max-width:768px){.grid{grid-template-columns:1fr;}}
.chart-card{background:#ffffff;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-radius:12px;padding:clamp(12px,2vw,20px);overflow:hidden;transition:transform .2s,box-shadow .2s;}
.chart-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);}
.chart-card h3{font-size:clamp(12px,1.5vw,14px);margin-bottom:8px;color:#111827;font-weight:600;letter-spacing:.3px;}
.chart-desc{font-size:11px;color:#6b7280;margin-bottom:6px;}`;
}

/** 生成看板/大屏的 HTML shell（</head><body><div.header><div.grid> 部分）。 */
export function buildHtmlHead(options: {
	title: string;
	chartJsCdn: string;
	isScreen: boolean;
}): string {
	const { title, chartJsCdn, isScreen } = options;
	const css = buildShellCss(isScreen);
	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="${chartJsCdn}"></script>
<style>${css}</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${isScreen ? "数据大屏 · Auto Layout" : "企业看板 · Auto Layout"}</p>
</div>`;
}
