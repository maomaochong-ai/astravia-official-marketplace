// Chart.js defaults —— 看板浅 QuickBI 风（注入 iframe <script>）
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

  // ── scales 默认值（覆盖所有 scale 类型）──
  var gridColor = 'rgba(156,163,175,0.25)';
  var tickColor = '#6b7280';
  Chart.defaults.scales.linear.grid.color = gridColor;
  Chart.defaults.scales.linear.border.display = false;
  Chart.defaults.scales.linear.ticks.color = tickColor;
  Chart.defaults.scales.linear.ticks.padding = 4;
  Chart.defaults.scales.category.grid.color = gridColor;
  Chart.defaults.scales.category.border.display = false;
  Chart.defaults.scales.category.ticks.color = tickColor;
  Chart.defaults.scales.category.ticks.padding = 4;
  Chart.defaults.scales.logarithmic.grid.color = gridColor;
  Chart.defaults.scales.logarithmic.border.display = false;
  Chart.defaults.scales.logarithmic.ticks.color = tickColor;
  Chart.defaults.scales.radialLinear.grid.color = gridColor;
  Chart.defaults.scales.radialLinear.border.display = false;
  Chart.defaults.scales.radialLinear.ticks.color = tickColor;
  Chart.defaults.scales.radialLinear.angleLines.color = gridColor;
  Chart.defaults.scales.radialLinear.pointLabels.color = tickColor;

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
