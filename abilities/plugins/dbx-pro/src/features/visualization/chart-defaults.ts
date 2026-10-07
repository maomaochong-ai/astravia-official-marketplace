/**
 * Chart.js 默认配置 —— 注入到 iframe <script> 的 IIFE 代码。
 *
 * 为什么需要这套？
 *   iframe 是独立 document，CDN Chart.js 用默认值：borderWidth=1, borderColor="#000"。
 *   宿主 render_chart 在 React 里用的是同一个全局 ChartJS 实例（入口设了 defaults），
 *   但 iframe 的 CDN UMD 不会继承，所以必须显式设置。
 *
 * 覆盖所有 Chart.js scale 类型，确保 bar/line/pie/radar/polarArea/scatter/bubble
 * 都有一致的视觉风格。
 */

/**
 * 生成 Chart.js defaults 配置的 IIFE 代码字符串。
 * @param isScreen true 为大屏深 DataV 风，false 为看板浅 QuickBI 风
 */
export function buildChartDefaultsScript(isScreen: boolean): string {
	const gridColor = isScreen ? "rgba(148,163,184,0.15)" : "rgba(156,163,175,0.25)";
	const tickColor = isScreen ? "#94a3b8" : "#6b7280";

	return `(function(){
  // ── 元素默认值 ──
  Chart.defaults.elements.bar.borderWidth = 0;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.elements.bar.borderColor = 'transparent';
  Chart.defaults.elements.arc.borderWidth = 0;
  Chart.defaults.elements.arc.borderColor = 'transparent';
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.line.borderCapStyle = 'round';
  Chart.defaults.elements.line.tension = 0.35;
  Chart.defaults.elements.point.radius = 2;
  Chart.defaults.elements.point.hoverRadius = 4;
  Chart.defaults.elements.point.borderWidth = 0;

  // ── scales 默认值（覆盖所有 scale 类型）──
  // linear（bar/line/scatter/bubble 用）
  Chart.defaults.scales.linear.grid.color = '${gridColor}';
  Chart.defaults.scales.linear.border.display = false;
  Chart.defaults.scales.linear.ticks.color = '${tickColor}';
  Chart.defaults.scales.linear.ticks.padding = 4;
  // category（bar/line 用）
  Chart.defaults.scales.category.grid.color = '${gridColor}';
  Chart.defaults.scales.category.border.display = false;
  Chart.defaults.scales.category.ticks.color = '${tickColor}';
  Chart.defaults.scales.category.ticks.padding = 4;
  // logarithmic / time（潜在用到）
  Chart.defaults.scales.logarithmic.grid.color = '${gridColor}';
  Chart.defaults.scales.logarithmic.border.display = false;
  Chart.defaults.scales.logarithmic.ticks.color = '${tickColor}';
  // radialLinear（radar/polarArea 用）
  Chart.defaults.scales.radialLinear.grid.color = '${gridColor}';
  Chart.defaults.scales.radialLinear.border.display = false;
  Chart.defaults.scales.radialLinear.ticks.color = '${tickColor}';
  Chart.defaults.scales.radialLinear.angleLines.color = '${gridColor}';
  Chart.defaults.scales.radialLinear.pointLabels.color = '${tickColor}';

  // ── 全局默认 plugins（深度 merge 由 __dbxMergeOpts 做）──
  window.__dbxDefaultChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "bottom" }, tooltip: { enabled: true } }
  };

  // Chart.js options 深度 merge —— 避免 Agent 自定义 plugins 时覆盖默认 tooltip/legend
  window.__dbxMergeOpts = function(user) {
    user = user || {};
    var defaults = window.__dbxDefaultChartOptions;
    var opts = Object.assign({}, defaults, user);
    if (user.plugins) {
      opts.plugins = Object.assign({}, defaults.plugins, user.plugins);
      if (typeof user.plugins.legend === 'object') opts.plugins.legend = Object.assign({}, defaults.plugins.legend, user.plugins.legend);
      if (typeof user.plugins.tooltip === 'object') opts.plugins.tooltip = Object.assign({}, defaults.plugins.tooltip, user.plugins.tooltip);
    }
    return opts;
  };
})();`;
}
