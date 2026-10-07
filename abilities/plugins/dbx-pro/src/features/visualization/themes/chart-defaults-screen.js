// Chart.js defaults —— 大屏深 DataV 风（注入 iframe <script>）
// Chart.js v4 正确 API：Chart.defaults.scale（没有 s），不是 Chart.defaults.scales.linear（有 s，是具体类型）
(function(){
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

  // ── 全局 scale 默认值（Chart.js v4：scale 没有 s）──
  var gridColor = 'rgba(148,163,184,0.15)';
  var tickColor = '#94a3b8';
  Chart.defaults.scale.grid.color = gridColor;
  if (Chart.defaults.scale.border) Chart.defaults.scale.border.display = false;
  Chart.defaults.scale.ticks.color = tickColor;
  Chart.defaults.scale.ticks.padding = 4;

  // radialLinear（雷达/极坐标）自己有完整配置（除了 border）
  if (Chart.defaults.scales && Chart.defaults.scales.radialLinear) {
    var rl = Chart.defaults.scales.radialLinear;
    if (rl.grid) rl.grid.color = gridColor;
    if (rl.border) rl.border.display = false;
    if (rl.ticks) rl.ticks.color = tickColor;
    if (rl.angleLines) rl.angleLines.color = gridColor;
    if (rl.pointLabels) rl.pointLabels.color = tickColor;
  }

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
})();
