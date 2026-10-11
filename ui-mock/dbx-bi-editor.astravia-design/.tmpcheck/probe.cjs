// .tmpcheck/probe.tsx
var import_server = require("react-dom/server");
var import_react2 = require("react");

// components/Icon.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Icon({
  name,
  className = "size-3.5"
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, className: `${name} ${className} inline-block shrink-0` });
}

// components/Btn.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var VARIANTS = {
  default: "border border-border bg-surface-raised text-surface-foreground hover:border-border-strong hover:bg-surface-sunken",
  primary: "border border-primary bg-primary text-primary-foreground hover:opacity-90",
  ghost: "border border-transparent text-muted hover:bg-surface-raised hover:text-surface-foreground",
  quiet: "border border-transparent text-muted hover:text-surface-foreground",
  ai: "border border-ai/40 bg-ai-soft text-ai hover:opacity-90",
  danger: "border border-danger/40 bg-danger-soft text-danger hover:opacity-90"
};
var SIZES = {
  xs: "h-6 gap-1 px-2 text-[12px]",
  sm: "h-7 gap-1.5 px-2.5 text-[12px]",
  md: "h-8 gap-1.5 px-3 text-[14px]"
};
var ICON_SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4"
};
function Btn({
  variant = "default",
  size = "md",
  icon,
  children,
  title,
  disabled,
  className = ""
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      title,
      disabled,
      className: `inline-flex appearance-none select-none items-center justify-center whitespace-nowrap rounded-control font-sans font-medium ${SIZES[size]} ${VARIANTS[variant]}${disabled ? " text-faint" : ""} ${className}`,
      children: [
        icon ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: icon, className: ICON_SIZES[size] }) : null,
        children
      ]
    }
  );
}

// components/Chip.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var TONES = {
  neutral: "bg-neutral-muted text-muted",
  accent: "bg-accent-soft text-accent",
  primary: "bg-primary/15 text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  ai: "bg-ai-soft text-ai"
};
function Chip({
  children,
  tone = "neutral",
  mono = false,
  icon,
  className = ""
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "span",
    {
      className: `inline-flex h-[18px] shrink-0 items-center gap-1 rounded-chip px-1.5 text-[10px] leading-none whitespace-nowrap ${TONES[tone]} ${mono ? "font-mono tabular-nums" : "font-sans"} ${className}`,
      children: [
        icon ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "aria-hidden": true, className: `${icon} size-2.5` }) : null,
        children
      ]
    }
  );
}

// components/Charts.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var SERIES = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)"
];
var seriesColor = (i) => SERIES[i % SERIES.length];
function ticks(min, max, count = 4) {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(step * (count - 1 - i) + min));
}
function AreaChart({
  values,
  stroke = "var(--color-series-1)",
  dash = false,
  fill,
  className = "h-full w-full",
  gridLines = [25, 50, 75],
  grid = true,
  domain
}) {
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? i / (values.length - 1) * 100 : 0;
    const y = 100 - (v - min) / span * 88 - 6;
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", className, children: [
    grid ? gridLines.map((y) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "line",
      {
        x1: "0",
        y1: y,
        x2: "100",
        y2: y,
        stroke: "var(--color-screen-line)",
        strokeWidth: "1",
        vectorEffect: "non-scaling-stroke"
      },
      y
    )) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: `${line} L100,100 L0,100 Z`, fill: fill ?? stroke, opacity: "0.16" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "path",
      {
        d: line,
        fill: "none",
        stroke,
        strokeDasharray: dash ? "4 3" : void 0,
        strokeWidth: "1.75",
        vectorEffect: "non-scaling-stroke"
      }
    )
  ] });
}
function yPercent(v, min, max) {
  const span = max - min || 1;
  return 94 - (v - min) / span * 88;
}
function Sparkline({
  values,
  stroke = "var(--color-series-1)",
  className = "h-8 w-full"
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => {
    const x = i / (values.length - 1) * 100;
    const y = 28 - (v - min) / span * 26 - 1;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 100 30", preserveAspectRatio: "none", className, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d, fill: "none", stroke, strokeWidth: "1.5", vectorEffect: "non-scaling-stroke" }) });
}
function Bars({
  values,
  className = "h-16",
  tone = "bg-series-1",
  gap = "gap-1"
}) {
  const max = Math.max(...values);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: `flex items-end ${gap} ${className}`, children: values.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      className: `flex-1 rounded-t-[2px] ${tone}`,
      style: { height: `${Math.max(4, v / max * 100)}%` }
    },
    i
  )) });
}
function HBars({
  rows,
  className = "",
  tone = "bg-series-1"
}) {
  const max = Math.max(...rows.map((r) => r.value));
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: `flex flex-col gap-2 ${className}`, children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "w-9 shrink-0 truncate text-[11px] text-muted", children: r.label }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "flex min-w-0 flex-1 items-center", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "span",
      {
        className: `h-2.5 rounded-r-[2px] ${tone}`,
        style: { width: `${Math.max(3, r.value / max * 100)}%` }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "shrink-0 font-mono text-[11px] tabular-nums text-surface-foreground", children: r.text })
  ] }, r.label)) });
}
function Donut({
  segments,
  size = 96,
  thickness = 14,
  holeFill = "var(--color-surface)",
  className = ""
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let acc = 0;
  const stops = segments.map((s) => {
    const from = acc / total * 100;
    acc += s.value;
    return `${s.color} ${from.toFixed(2)}% ${(acc / total * 100).toFixed(2)}%`;
  }).join(", ");
  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), rgb(0 0 0) calc(100% - ${thickness}px))`;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "span",
    {
      className: `relative shrink-0 rounded-full ${className}`,
      style: {
        width: size,
        height: size,
        background: `conic-gradient(${stops})`,
        maskImage: mask,
        WebkitMaskImage: mask
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "span",
        {
          className: "absolute inset-0 m-auto rounded-full",
          style: { background: holeFill, width: size - thickness * 2, height: size - thickness * 2 }
        }
      )
    }
  );
}
function Funnel({
  stages,
  className = ""
}) {
  const max = stages[0].value;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: `flex flex-col items-center gap-1 ${className}`, children: stages.map((s) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "span",
    {
      className: "flex h-[22px] min-w-0 items-center justify-between gap-1 overflow-hidden rounded-[3px] bg-series-1/25 px-2 text-[10px] whitespace-nowrap",
      style: { width: `${Math.max(30, s.value / max * 100)}%` },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "truncate text-surface-foreground", children: s.label }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "shrink-0 font-mono tabular-nums text-muted", children: s.text })
      ]
    },
    s.label
  )) });
}
function Gauge({
  value,
  className = "h-[72px] w-[132px]",
  tone = "var(--color-series-1)"
}) {
  const r = 50;
  const cx = 60;
  const cy = 56;
  const len = Math.PI * r;
  const d = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { viewBox: "0 0 120 61", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d, fill: "none", stroke: "var(--color-border)", strokeWidth: "9", strokeLinecap: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "path",
      {
        d,
        fill: "none",
        stroke: tone,
        strokeWidth: "9",
        strokeLinecap: "round",
        strokeDasharray: `${(value / 100 * len).toFixed(1)} ${len.toFixed(1)}`
      }
    )
  ] });
}

// components/IconButton.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var SIZES2 = {
  xs: "size-6",
  sm: "size-7",
  md: "size-8"
};
var TONES2 = {
  default: "text-muted hover:bg-neutral-muted hover:text-surface-foreground",
  danger: "text-muted hover:bg-danger-soft hover:text-danger",
  ai: "text-ai hover:bg-ai-soft"
};
function IconButton({
  icon,
  size = "sm",
  tone = "default",
  active = false,
  disabled,
  title,
  className = ""
}) {
  const variant = active ? "bg-accent-soft text-accent" : TONES2[tone];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "button",
    {
      type: "button",
      title,
      disabled,
      className: `grid shrink-0 appearance-none place-items-center rounded-control ${SIZES2[size]} ${variant}${disabled ? " text-faint" : ""} ${className}`,
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: icon, className: size === "xs" ? "size-3" : "size-3.5" })
    }
  );
}

// components/editor/CanvasGround.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function linkPath(l) {
  const bend = Math.max(36, (l.x2 - l.x1) * 0.5);
  return `M ${l.x1} ${l.y1} C ${l.x1 + bend} ${l.y1}, ${l.x2 - bend} ${l.y2}, ${l.x2} ${l.y2}`;
}
function CanvasGround({ groups = [], links = [], children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      className: "relative min-h-0 flex-1 overflow-hidden bg-background",
      style: {
        backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "16px 16px"
      },
      children: [
        groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            className: "absolute rounded-card border border-dashed border-border",
            style: { left: g.x, top: g.y, width: g.w, height: g.h },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-chip border border-border bg-surface-raised px-1.5 text-[10px] whitespace-nowrap text-muted", children: [
              g.label,
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "font-mono text-[9px] tabular-nums text-faint", children: g.count })
            ] })
          },
          g.label
        )),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { className: "pointer-events-none absolute inset-0 h-full w-full", children: links.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "path",
          {
            d: linkPath(l),
            fill: "none",
            stroke: l.tone,
            strokeWidth: 1.5,
            strokeDasharray: l.dashed ? "4 3" : void 0
          },
          i
        )) }),
        children
      ]
    }
  );
}

// components/editor/EditorToolbar.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function EditorToolbar() {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("header", { className: "flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconButton, { icon: "icon-[lucide--arrow-left]", title: "\u8FD4\u56DE BI \u6570\u636E\u8D44\u4EA7" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "truncate text-[14px] font-semibold text-surface-foreground", children: "\u6E20\u9053\u7ECF\u8425\u770B\u677F" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { children: "\u770B\u677F" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "flex shrink-0 items-center gap-1.5 text-[11px] whitespace-nowrap text-warning", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "size-1.5 rounded-full bg-warning" }),
      "\u672A\u4FDD\u5B58\u7684\u66F4\u6539"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "ml-1 font-mono text-[11px] tabular-nums whitespace-nowrap text-faint", children: "6 \u8282\u70B9 \xB7 3 \u9875 \xB7 \u4E0A\u6B21\u4FDD\u5B58 10:24" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-1.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center gap-0.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconButton, { icon: "icon-[lucide--rotate-ccw]", title: "\u64A4\u9500 \u2318Z" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconButton, { icon: "icon-[lucide--rotate-cw]", title: "\u91CD\u505A \u21E7\u2318Z", disabled: true })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "button",
        {
          type: "button",
          className: "flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "icon-[lucide--layout-grid]", className: "size-3.5 text-muted" }),
            "\u81EA\u52A8\u5E03\u5C40",
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-3 text-faint" })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center rounded-control border border-border bg-surface p-0.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "flex h-6 items-center rounded-[4px] bg-accent-soft px-2 text-[12px] font-medium text-accent", children: "\u6DF1\u8272" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "flex h-6 items-center px-2 text-[12px] text-muted", children: "\u6D45\u8272" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconButton, { icon: "icon-[lucide--ruler]", title: "\u5BF9\u9F50\u8F85\u52A9\u7EBF\uFF1A\u5F00", active: true }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "ai", size: "sm", icon: "icon-[lucide--wand-sparkles]", children: "AI \u751F\u6210\u8282\u70B9" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconButton, { icon: "icon-[lucide--keyboard]", title: "\u5FEB\u6377\u952E \u2318/" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { size: "sm", icon: "icon-[lucide--layout-dashboard]", children: "\u9884\u89C8\u4EA7\u7269" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--play]", children: "\u8FD0\u884C\u753B\u5E03" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { size: "sm", icon: "icon-[lucide--save]", children: "\u4FDD\u5B58" })
    ] })
  ] });
}

// components/editor/NodeCard.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var HEAD_H = 30;
var ROW_H = 24;
var BODY_PAD = 8;
function rowDy(row) {
  return HEAD_H + BODY_PAD + ROW_H * row + ROW_H / 2;
}
var TONE = {
  table: "var(--color-series-1)",
  result: "var(--color-ai)",
  chart: "var(--color-series-2)",
  control: "var(--color-warning)"
};
var HANDLE = "absolute size-1.5 rounded-[1px] border border-background bg-accent";
function NodeCard({
  title,
  type,
  icon,
  tone,
  x,
  y,
  w,
  h,
  selected = false,
  inputs = [],
  outputs = [],
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: `absolute flex flex-col rounded-card border bg-surface-raised ${selected ? "z-10 border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"}`,
      style: { left: x, top: y, width: w, height: h },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("header", { className: "flex h-[30px] shrink-0 items-center gap-1.5 border-b border-border bg-background px-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-3 shrink-0 text-faint" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "span",
            {
              className: "grid size-[18px] shrink-0 place-items-center rounded-[4px] bg-neutral-muted",
              style: { color: tone },
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: icon, className: "size-3" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] font-medium text-surface-foreground", children: title }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "shrink-0 font-mono text-[9px] text-faint", children: type })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2", children }),
        inputs.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "span",
          {
            title: "\u8F93\u5165\u63D2\u69FD",
            className: "absolute -left-[5px] size-2.5 rounded-full border-2 border-surface-raised",
            style: { top: rowDy(s.row) - 5, background: s.tone }
          },
          `in-${i}`
        )),
        outputs.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "span",
          {
            title: "\u8F93\u51FA\u63D2\u69FD",
            className: "absolute -right-[5px] size-2.5 rounded-full border-2 border-surface-raised",
            style: { top: rowDy(s.row) - 5, background: s.tone }
          },
          `out-${i}`
        )),
        selected ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -top-[3px] -left-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -top-[3px] left-1/2 -ml-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -top-[3px] -right-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} top-1/2 -left-[3px] -mt-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} top-1/2 -right-[3px] -mt-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -bottom-[3px] -left-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -bottom-[3px] left-1/2 -ml-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `${HANDLE} -right-[3px] -bottom-[3px]` })
        ] }) : null
      ]
    }
  );
}
function NodeRow({ label, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "w-[46px] shrink-0 truncate text-[10px] text-muted", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "flex min-w-0 flex-1 items-center", children })
  ] });
}
function NodeValue({ children, mono = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "span",
    {
      className: `min-w-0 flex-1 truncate text-[10px] text-surface-foreground ${mono ? "font-mono tabular-nums" : ""}`,
      children
    }
  );
}
function NodeSelect({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "flex h-[18px] min-w-0 flex-1 items-center gap-1 rounded-[4px] border border-border bg-surface px-1.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "min-w-0 flex-1 truncate text-[10px] text-surface-foreground", children }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-2.5 shrink-0 text-faint" })
  ] });
}
function NodeSeg({ options, active }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "flex h-[18px] min-w-0 shrink-0 items-center gap-0.5 rounded-[4px] border border-border bg-surface p-0.5", children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "span",
    {
      className: `flex h-[13px] shrink-0 items-center rounded-[3px] px-1.5 text-[9px] whitespace-nowrap ${o === active ? "bg-accent-soft font-medium text-accent" : "text-muted"}`,
      children: o
    },
    o
  )) });
}

// frames/agent.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var STEPS = [
  { icon: "icon-[lucide--circle-check]", label: "\u63A5\u4E0A\u6570\u636E\u6E90 ods_orders", note: "\u5DF2\u5B8C\u6210", on: "done" },
  { icon: "icon-[lucide--circle-check]", label: "\u5199 SQL \u6C47\u603B\u51FA ds_orders", note: "\u5DF2\u5B8C\u6210", on: "done" },
  { icon: "icon-[lucide--circle-check]", label: "\u751F\u6210 3 \u4E2A\u56FE\u8868\u8282\u70B9", note: "\u5DF2\u5B8C\u6210", on: "done" },
  { icon: "icon-[lucide--loader]", label: "\u642D\u5927\u5C4F\u9AA8\u67B6\uFF08\u6807\u9898 + 4 \u6307\u6807\u5361 + \u6392\u884C\u699C\uFF09", note: "\u8FDB\u884C\u4E2D", on: "run" },
  { icon: "icon-[lucide--clock]", label: "\u7ED1\u5B9A\u7B5B\u9009\u5668\u4E0E\u65E5\u671F\u533A\u95F4", note: "\u5F85\u529E", on: "todo" },
  { icon: "icon-[lucide--clock]", label: "\u53D1\u5E03\u5230\u5DE5\u4F5C\u6811\u5E76\u7ED9\u51FA\u94FE\u63A5", note: "\u5F85\u529E", on: "todo" }
];
var STEP_CLS = {
  done: "text-success",
  run: "text-accent animate-spin",
  todo: "text-faint"
};
var GROUPS = [{ x: 16, y: 348, w: 992, h: 148, label: "AI \u5F85\u63D2\u5165 \xB7 \u5927\u5C4F 4 \u4E2A\u8282\u70B9", count: 4 }];
var LINKS = [
  { x1: 214, y1: 92, x2: 240, y2: 92, tone: TONE.table },
  { x1: 430, y1: 92, x2: 456, y2: 84, tone: TONE.table },
  { x1: 430, y1: 92, x2: 456, y2: 228, tone: TONE.table }
];
var PENDING = [
  { icon: "icon-[lucide--monitor]", label: "\u5927\u5C4F\u6807\u9898" },
  { icon: "icon-[lucide--activity]", label: "\u5927\u5C4F\u6307\u6807\u5361 \xD72" },
  { icon: "icon-[lucide--list-ordered]", label: "\u5927\u5C4F\u6392\u884C\u699C" }
];
function AgentConversation() {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "flex w-[400px] shrink-0 flex-col border-r border-border bg-surface-raised", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--bot]", className: "size-3.5 shrink-0 text-ai" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u667A\u80FD\u4F53\u4F1A\u8BDD" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Chip, { tone: "ai", children: "\u5BBF\u4E3B\u6A21\u578B" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u5DE5\u4F5C\u6811 \xB7 \u53EA\u8BFB" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "flex justify-end", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "max-w-[300px] rounded-card rounded-br-[4px] border border-border bg-surface px-2.5 py-2 text-[12px] leading-5 text-surface-foreground", children: "\u4E0A\u4E00\u5B63\u5EA6\u7684\u6E20\u9053\u7ECF\u8425\u505A\u4E00\u4E2A\u5927\u5C4F\uFF0C\u91CD\u70B9\u770B\u534E\u4E1C\u548C\u6296\u97F3\uFF0C\u6DF1\u8272\u5E95\uFF0C\u6570\u5B57\u8981\u5927\u3002" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "grid h-5 shrink-0 place-items-center", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--bot]", className: "size-4 text-ai" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "text-[12px] leading-5 text-surface-foreground", children: "\u5148\u628A\u8BA1\u5212\u5217\u51FA\u6765\uFF0C\u6BCF\u4E00\u6B65\u90FD\u843D\u5728\u753B\u5E03\u4E0A\u771F\u5B9E\u5B58\u5728\u7684\u8282\u70B9\u4E0A\uFF1A" }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2", children: STEPS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: s.icon, className: `size-3.5 shrink-0 ${STEP_CLS[s.on]}` }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] text-surface-foreground", children: s.label }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "shrink-0 text-[10px] text-faint", children: s.note })
              ] }, s.label)) }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "rounded-card border border-ai bg-surface px-2.5 py-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--wand-sparkles]", className: "size-3.5 shrink-0 text-ai" }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u9700\u8981\u4F60\u786E\u8BA4" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "mt-1 text-[11px] leading-5 text-muted", children: "\u5927\u5C4F\u653E 8 \u4E2A\u8282\u70B9\uFF1A\u6807\u9898\u6761 + 4 \u5F20\u6307\u6807\u5361 + \u6298\u7EBF + \u6F0F\u6597 + \u6392\u884C\u699C\u3002\u4E3B\u8272\u6CBF\u7528\u79D1\u6280\u8272\uFF0C \u9608\u503C\uFF1AGMV \u4F4E\u4E8E 60 \u4E07\u6807\u9EC4\u3002" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--square-plus]", children: "\u63D2\u5165\u753B\u5E03\u5E76\u8FD0\u884C" }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Btn, { size: "sm", variant: "ghost", children: "\u5148\u770B\u8349\u7A3F" }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ml-auto text-[10px] text-faint", children: "\u4E0D\u5199\u5E93" })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex shrink-0 flex-col gap-2 border-t border-border px-3 py-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "flex h-14 items-start gap-2 rounded-card border border-border bg-surface px-2.5 py-2", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "mt-0.5 text-[12px] text-faint", children: "\u8FD8\u53EF\u4EE5\u8BF4\uFF1A\u628A\u534E\u4E1C\u6362\u6210\u897F\u5357\uFF0C\u6307\u6807\u5361\u7559\u4E24\u5F20\u2026" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[10px] text-faint", children: "Enter \u53D1\u9001 \xB7 \u21E7Enter \u6362\u884C" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--send]", className: "ml-auto", children: "\u53D1\u9001" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--layout-dashboard]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u753B\u5E03 \xB7 \u8349\u7A3F\u533A" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Chip, { tone: "accent", children: "AI \u5DF2\u63D2\u5165 3 \u4E2A\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Chip, { tone: "warning", children: "4 \u4E2A\u5F85\u786E\u8BA4" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--minus]", title: "\u7F29\u5C0F" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted", children: "100%" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--plus]", title: "\u653E\u5927" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(CanvasGround, { groups: GROUPS, links: LINKS, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            NodeCard,
            {
              title: "ods_orders",
              type: "\u6570\u636E\u6E90",
              icon: "icon-[lucide--database]",
              tone: TONE.table,
              x: 24,
              y: 40,
              w: 190,
              h: 104,
              outputs: [{ row: 0, tone: TONE.table }],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u8FDE\u63A5", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { mono: true, children: "prod-mysql" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u6A21\u5F0F", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { children: "\u76F4\u8FDE \xB7 \u4E0D\u843D\u5E93" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            NodeCard,
            {
              title: "ds_orders",
              type: "\u6570\u636E\u96C6",
              icon: "icon-[lucide--scroll-text]",
              tone: TONE.table,
              x: 240,
              y: 40,
              w: 190,
              h: 104,
              inputs: [{ row: 0, tone: TONE.table }],
              outputs: [{ row: 1, tone: TONE.table }],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u5B57\u6BB5", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { mono: true, children: "8 \u5217" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u6765\u6E90", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { children: "AI \u5199\u7684 SQL" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            NodeCard,
            {
              title: "line_gmv_14d",
              type: "\u6298\u7EBF\u56FE",
              icon: "icon-[lucide--chart-line]",
              tone: TONE.chart,
              x: 456,
              y: 24,
              w: 196,
              h: 120,
              inputs: [{ row: 0, tone: TONE.table }],
              outputs: [{ row: 2, tone: TONE.chart }],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "X \u8F74", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { mono: true, children: "date" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "Y \u8F74", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { mono: true, children: "gmv" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u5BF9\u6BD4", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { children: "\u53BB\u5E74\u540C\u671F" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            NodeCard,
            {
              title: "donut_channel",
              type: "\u73AF\u56FE",
              icon: "icon-[lucide--chart-pie]",
              tone: TONE.chart,
              x: 456,
              y: 172,
              w: 196,
              h: 120,
              inputs: [{ row: 0, tone: TONE.table }],
              outputs: [{ row: 2, tone: TONE.chart }],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u7EF4\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { mono: true, children: "channel" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u9AD8\u4EAE", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { children: "\u6296\u97F3 \xB7 \u534E\u4E1C" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeRow, { label: "\u8C03\u8272\u677F", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NodeValue, { children: "\u79D1\u6280" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "absolute left-[32px] top-[368px] flex items-center gap-3", children: PENDING.map((p) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            "div",
            {
              className: "flex h-[46px] w-[228px] items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface/60 px-3",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: p.icon, className: "size-4 shrink-0 text-muted" }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[11px] text-muted", children: p.label }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--clock]", className: "ml-auto size-3.5 shrink-0 text-faint" })
              ]
            },
            p.label
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "absolute bottom-4 left-6 right-6 flex h-9 items-center gap-3 rounded-card border border-border bg-surface-raised px-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "icon-[lucide--lock]", className: "size-3.5 shrink-0 text-faint" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "text-[10px] text-faint", children: "\u4F1A\u8BDD\u4E0D\u76F4\u63A5\u6539\u5DE5\u4F5C\u6811\uFF1BAI \u751F\u6210\u7684\u8282\u70B9\u5148\u843D\u5728\u8349\u7A3F\u533A\uFF0C\u786E\u8BA4\u540E\u624D\u63A5\u8FDB\u4E3B\u94FE\u8DEF" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u672C\u6B21\u4F1A\u8BDD #7f2a" })
          ] })
        ] })
      ] })
    ] })
  ] });
}

// components/editor/AiNodeOverlays.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var FROM_CHIP = {
  ai: { text: "AI \u63A8\u65AD", tone: "ai" },
  user: { text: "\u624B\u52A8", tone: "default" },
  dataset: { text: "\u53D6\u81EA\u6570\u636E\u96C6", tone: "default" }
};
function AiGenerateDialog({ x, y }) {
  const rows = [
    { field: "\u56FE\u8868\u7C7B\u578B", value: "\u6298\u7EBF\u56FE \xB7 \u9762\u79EF", from: "ai" },
    { field: "\u6570\u636E\u96C6", value: "SQL ds_orders \xB7 \u4E00\u952E\u5957\u7528", from: "dataset" },
    { field: "X \u8F74", value: "\u65E5\u671F \xB7 \u8FD1 14 \u5929", from: "ai" },
    { field: "Y \u8F74", value: "GMV(\u5143) \xB7 \u6C42\u548C", from: "ai" },
    { field: "\u5BF9\u6BD4", value: "\u53BB\u5E74\u540C\u671F \xB7 \u865A\u7EBF", from: "ai" },
    { field: "\u8C03\u8272\u677F", value: "\u79D1\u6280", from: "user" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      className: "absolute z-30 w-[336px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
      style: { left: x, top: y },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("header", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "icon-[lucide--wand-sparkles]", className: "size-3.5 shrink-0 text-ai" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "AI \u751F\u6210\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "ml-auto flex shrink-0 items-center gap-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Chip, { children: "\u5BBF\u4E3B\u6A21\u578B" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--x]", title: "\u5173\u95ED" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "flex items-start gap-2 border-b border-border px-3 py-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "icon-[lucide--bot]", className: "size-3 text-accent" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "text-[11px] leading-4 text-surface-foreground", children: "\u628A ods_orders \u6309\u6E20\u9053\u505A\u8FD1 14 \u5929 GMV \u8D8B\u52BF\uFF0C\u6807\u51FA\u53BB\u5E74\u540C\u671F\uFF0C\u989C\u8272\u7528\u79D1\u6280\u8272\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "px-3 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[10px] text-faint", children: "\u751F\u6210\u7ED3\u679C" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "font-mono text-[10px] text-surface-foreground", children: "line_gmv_14d" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "ml-auto text-[10px] text-muted", children: "6 \u9879\u53C2\u6570 \xB7 4 \u9879\u5F85\u786E\u8BA4" })
          ] }),
          rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "w-[52px] shrink-0 truncate text-[10px] text-muted", children: r.field }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "min-w-0 flex-1 truncate text-[10px] text-surface-foreground", children: r.value }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "span",
              {
                className: `shrink-0 rounded-chip px-1.5 text-[9px] ${r.from === "ai" ? "bg-ai-soft text-ai" : "bg-neutral-muted text-muted"}`,
                children: FROM_CHIP[r.from].text
              }
            )
          ] }, r.field))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("footer", { className: "flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip bg-success-soft px-2 text-[10px] text-success", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-success" }),
            "\u672A\u5199\u5165\u6570\u636E\u5E93"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Btn, { variant: "ghost", children: "\u91CD\u65B0\u751F\u6210" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Btn, { variant: "primary", children: "\u63D2\u5165\u753B\u5E03" })
          ] })
        ] })
      ]
    }
  );
}
function ParamSuggest({ x, y }) {
  const chips = ["\u6539\u4E3A\u6309\u5468\u805A\u5408", "\u6362\u6210\u5806\u53E0", "\u52A0\u53BB\u5E74\u540C\u671F\u5BF9\u6BD4"];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      className: "absolute z-30 w-[264px] overflow-hidden rounded-card border border-ai bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
      style: { left: x, top: y },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("header", { className: "flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "icon-[lucide--wand-sparkles]", className: "size-3.5 shrink-0 text-ai" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "AI \u8C03\u6574 \xB7 \u8FD9\u4E00\u683C" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "px-2.5 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[10px] text-faint", children: "\u805A\u5408\u65B9\u5F0F" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "mt-1 flex h-6 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[10px] text-muted line-through", children: "\u6309\u65E5\u6C42\u548C" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "icon-[lucide--arrow-right]", className: "size-3 shrink-0 text-faint" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "rounded-[4px] bg-ai-soft px-1.5 py-0.5 text-[10px] font-medium text-ai", children: "\u6309\u5468\u6C42\u548C\uFF08ISO \u5468\uFF09" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "mt-2 text-[10px] leading-4 text-muted", children: "\u8FD1 14 \u5929\u62C6\u6210 3 \u4E2A\u6574\u5468\uFF0C\u8D8B\u52BF\u8282\u70B9\u66F4\u5C11\u4F46\u66F4\u7A33\uFF1B\u540C\u6BD4\u5217\u4F1A\u8DDF\u7740\u5BF9\u9F50\u5230\u5468\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "mt-2 flex flex-wrap gap-1", children: chips.map((c) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "span",
            {
              className: "flex h-6 items-center rounded-chip border border-border bg-surface px-2 text-[10px] text-surface-foreground",
              children: c
            },
            c
          )) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("footer", { className: "flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "text-[10px] text-faint", children: "\u53EA\u6539\u8FD9\u4E00\u683C" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Btn, { variant: "ghost", children: "\u5FFD\u7565" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Btn, { variant: "primary", icon: "icon-[lucide--check]", children: "\u5E94\u7528" })
          ] })
        ] })
      ]
    }
  );
}

// components/editor/CanvasStrip.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var GRID = ["16", "8", "\u5173"];
function CanvasStrip() {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Icon, { name: "icon-[lucide--layout-dashboard]", className: "size-3.5 shrink-0 text-muted" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "text-[12px] font-semibold text-surface-foreground", children: "\u6982\u89C8" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "flex h-[18px] shrink-0 items-center rounded-chip bg-neutral-muted px-1.5 font-mono text-[10px] tabular-nums text-muted", children: "\u7B2C 1 / 3 \u9875" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "font-mono text-[11px] tabular-nums whitespace-nowrap text-faint", children: "6 \u8282\u70B9 \xB7 5 \u8FDE\u63A5" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "text-[11px] text-faint", children: "\u8C03\u8272\u677F" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
          "button",
          {
            type: "button",
            title: "\u79D1\u6280 / \u653F\u52A1 / \u5546\u52A1 / \u81EA\u5B9A\u4E49",
            className: "flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "flex shrink-0 items-center gap-0.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "size-2 rounded-full bg-series-1" }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "size-2 rounded-full bg-series-2" }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "size-2 rounded-full bg-series-3" }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "size-2 rounded-full bg-series-4" })
              ] }),
              "\u79D1\u6280",
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-3 text-faint" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "text-[11px] text-faint", children: "\u7F51\u683C" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "flex items-center rounded-control border border-border bg-surface p-0.5", children: GRID.map((g) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "span",
          {
            className: `flex h-6 items-center rounded-[4px] px-2 font-mono text-[12px] ${g === "16" ? "bg-accent-soft font-medium text-accent" : "text-muted"}`,
            children: g
          },
          g
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          className: "flex h-7 shrink-0 items-center rounded-control px-2 text-[12px] text-muted hover:bg-neutral-muted hover:text-surface-foreground",
          children: "\u9002\u914D\u89C6\u56FE"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex items-center gap-0.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--minus]", title: "\u7F29\u5C0F" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "w-9 text-center font-mono text-[11px] tabular-nums text-muted", children: "100%" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--plus]", title: "\u653E\u5927" })
      ] })
    ] })
  ] });
}

// components/editor/EditorStatusBar.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var PAGES = [
  { name: "\u6982\u89C8", active: true, dirty: true },
  { name: "\u6E20\u9053\u660E\u7EC6", active: false, dirty: false },
  { name: "\u57CE\u5E02\u5206\u5E03", active: false, dirty: false }
];
function EditorStatusBar() {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("footer", { className: "flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "flex shrink-0 items-center gap-1.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "flex h-6 shrink-0 items-center gap-1.5 rounded-chip bg-success-soft px-2 text-[11px] whitespace-nowrap text-success", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-success" }),
        "\u5DF2\u8FD0\u884C \xB7 10:24 \xB7 1.2s"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "flex h-6 shrink-0 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[11px] whitespace-nowrap text-warning", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-warning" }),
        "1 \u4E2A\u53D8\u66F4\u672A\u8FD0\u884C"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "font-mono text-[11px] tabular-nums whitespace-nowrap text-faint", children: "\u8282\u70B9 6 \xB7 \u8FDE\u63A5 5 \xB7 \u4EA7\u7269 3 \u9875" }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "shrink-0 text-[10px] text-faint", children: "\u4EA7\u7269\u9875\u9762" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "flex shrink-0 items-center gap-1", children: [
        PAGES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
          "span",
          {
            className: `flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-[11px] whitespace-nowrap ${p.active ? "border-border bg-surface font-medium text-surface-foreground" : "border-transparent text-muted"}`,
            children: [
              p.name,
              p.dirty ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-warning" }) : null,
              p.active ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Icon, { name: "icon-[lucide--x]", className: "size-3 shrink-0 text-faint" }) : null
            ]
          },
          p.name
        )),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--plus]", title: "\u65B0\u5EFA\u4EA7\u7269\u9875\u9762" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "font-mono text-[11px] tabular-nums whitespace-nowrap text-faint", children: "\u81EA\u52A8\u4FDD\u5B58\u5DF2\u5F00\u542F \xB7 10:24" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--layers]", title: "\u4EA7\u7269\u56FE\u5C42\u987A\u5E8F" })
    ] })
  ] });
}

// components/editor/AiNodePanel.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
function AiNodePanel({ x, y, w, h }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
    "div",
    {
      className: "absolute z-30 flex flex-col rounded-card border border-border bg-surface-raised shadow-popover",
      style: { left: x, top: y, width: w, height: h },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("header", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Icon, { name: "icon-[lucide--wand-sparkles]", className: "size-3.5 shrink-0 text-ai" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "text-[12px] font-medium text-surface-foreground", children: "AI \u751F\u6210\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Chip, { tone: "ai", children: "\u5199 SQL" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "ml-auto flex shrink-0 items-center", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--panel-right-close]", title: "\u6536\u8D77\u9762\u677F" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col gap-2.5 px-3 py-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "flex h-[34px] shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-3.5 shrink-0 text-series-1" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] text-surface-foreground", children: "\u63D2\u4EF6\u5DE5\u4F5C\u53F0 \xB7 MySQL" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "shrink-0 font-mono text-[10px] text-faint", children: "orders_daily" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-3 shrink-0 text-faint" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "shrink-0 rounded-control bg-neutral-muted px-2 py-1 text-[11px] text-surface-foreground", children: "\u8FD1 14 \u5929 GMV \u6298\u7EBF\u56FE\uFF0C\u6E20\u9053\u7528\u73AF\u5F62\u56FE" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-border bg-background p-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "font-mono text-[10px] leading-[13px] text-muted", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "text-accent", children: "select" }),
                " d, sum(gmv) as gmv"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "text-accent", children: "from" }),
                " public.orders"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "text-accent", children: "where" }),
                " d >= current_date - 14"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "mt-auto flex shrink-0 items-center gap-1.5 pt-1 text-[9px] text-faint", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Icon, { name: "icon-[lucide--info]", className: "size-2.5" }),
              "\u53EA\u8BFB \xB7 \u4EC5 SELECT \xB7 \u4E0D\u6539\u52A8\u6E90\u5E93"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "flex shrink-0 items-center gap-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Btn, { variant: "ai", size: "sm", icon: "icon-[lucide--wand-sparkles]", children: "\u751F\u6210\u8282\u70B9" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Btn, { size: "sm", icon: "icon-[lucide--plus]", children: "\u63D2\u5165\u753B\u5E03" })
          ] })
        ] })
      ]
    }
  );
}

// components/editor/NodeGraph.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
var LAYOUT = {
  ds1: { x: 16, y: 56, w: 180, h: 118, tone: TONE.table },
  sql: { x: 220, y: 56, w: 192, h: 164, tone: TONE.result },
  line: { x: 436, y: 40, w: 216, h: 222, tone: TONE.chart },
  ds2: { x: 16, y: 490, w: 180, h: 118, tone: TONE.table },
  donut: { x: 436, y: 470, w: 216, h: 206, tone: TONE.chart },
  out: { x: 700, y: 300, w: 164, h: 194, tone: "var(--color-primary)" }
};
var LINKS2 = [
  { from: "ds1", fromRow: 0, to: "sql", toRow: 0, tone: TONE.table },
  { from: "sql", fromRow: 1, to: "line", toRow: 0, tone: TONE.result },
  { from: "ds2", fromRow: 0, to: "donut", toRow: 0, tone: TONE.table },
  { from: "line", fromRow: 4, to: "out", toRow: 0, tone: TONE.chart },
  { from: "donut", fromRow: 3, to: "out", toRow: 1, tone: TONE.chart }
];
var GROUPS2 = [
  { x: 4, y: 40, w: 204, h: 592, icon: "icon-[lucide--database]", label: "\u6570\u636E\u6E90", count: "2" },
  { x: 212, y: 40, w: 208, h: 190, icon: "icon-[lucide--scroll-text]", label: "SQL \u67E5\u8BE2", count: "1" },
  { x: 428, y: 24, w: 440, h: 668, icon: "icon-[lucide--chart-line]", label: "\u56FE\u8868\u4E0E\u4EA7\u7269", count: "3" }
];
var GMV = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
function linkPath2(l) {
  const a = LAYOUT[l.from];
  const b = LAYOUT[l.to];
  const x1 = a.x + a.w;
  const y1 = a.y + rowDy(l.fromRow);
  const x2 = b.x;
  const y2 = b.y + rowDy(l.toRow);
  const bend = Math.max(36, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}
var TOOLBOX = [
  { icon: "icon-[lucide--copy]", title: "\u590D\u5236\u8282\u70B9" },
  { icon: "icon-[lucide--zap]", title: "\u505C\u7528\uFF08\u65C1\u8DEF\uFF09" },
  { icon: "icon-[lucide--play]", title: "\u53EA\u8FD0\u884C\u8FD9\u4E2A\u8282\u70B9" },
  { icon: "icon-[lucide--ellipsis]", title: "\u66F4\u591A" }
];
function NodeGraph() {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
    "div",
    {
      className: "relative min-h-0 flex-1 overflow-hidden bg-background",
      style: {
        backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "16px 16px"
      },
      children: [
        GROUPS2.map((g) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          "div",
          {
            className: "absolute rounded-[8px] border border-border bg-surface/25",
            style: { left: g.x, top: g.y, width: g.w, height: g.h },
            children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-chip border border-border bg-background px-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Icon, { name: g.icon, className: "size-3 text-faint" }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "text-[10px] text-muted", children: g.label }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "font-mono text-[10px] text-faint", children: g.count })
            ] })
          },
          g.label
        )),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("svg", { className: "pointer-events-none absolute inset-0 h-full w-full", children: LINKS2.map((l, i) => {
          const hot = l.from === "line" || l.to === "line";
          return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "path",
            {
              d: linkPath2(l),
              fill: "none",
              stroke: l.tone,
              strokeWidth: hot ? 2 : 1.5,
              opacity: hot ? 0.95 : 0.6
            },
            i
          );
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.ds1,
            title: "orders_daily",
            type: "dataset",
            icon: "icon-[lucide--database]",
            outputs: [{ row: 0, tone: TONE.table }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8868", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "public.orders" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8FDE\u63A5", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "\u63D2\u4EF6\u5DE5\u4F5C\u53F0 \xB7 MySQL" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u89C4\u6A21", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "1,284 \u884C \xB7 \u65E5\u7C92\u5EA6" }) })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.ds2,
            title: "channel_share",
            type: "dataset",
            icon: "icon-[lucide--database]",
            outputs: [{ row: 0, tone: TONE.table }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8868", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "public.channel_dim" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8FDE\u63A5", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "\u63D2\u4EF6\u5DE5\u4F5C\u53F0 \xB7 MySQL" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u89C4\u6A21", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "6 \u884C \xB7 \u6E20\u9053" }) })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.sql,
            title: "gmv_14d",
            type: "sql",
            icon: "icon-[lucide--scroll-text]",
            inputs: [{ row: 0, tone: TONE.table }],
            outputs: [{ row: 1, tone: TONE.result }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8868", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "orders_daily" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(NodeRow, { label: "\u7ED3\u679C\u96C6", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "14 \xD7 2" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Chip, { tone: "ai", children: "AI \u751F\u6210" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-background px-1.5 py-1 font-mono text-[9.5px] leading-[13px] text-muted", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "text-accent", children: "select" }),
                  " d, sum(gmv) as gmv"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "text-accent", children: "from" }),
                  " public.orders"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "text-accent", children: "where" }),
                  " d >= current_date - 14"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "text-accent", children: "group by" }),
                  " d order by d"
                ] })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.line,
            title: "GMV \u8D8B\u52BF",
            type: "chartjs \xB7 line",
            icon: "icon-[lucide--chart-line]",
            selected: true,
            inputs: [{ row: 0, tone: TONE.result }],
            outputs: [{ row: 4, tone: TONE.chart }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u7ED3\u679C\u96C6", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { mono: true, children: "gmv_14d" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u7EF4\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "d \xB7 \u65E5\u671F" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u6570\u503C", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "gmv \xB7 \u6C42\u548C" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u56FE\u5F62", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSeg, { options: ["\u6298\u7EBF", "\u9762\u79EF"], active: "\u9762\u79EF" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8F93\u51FA\u53BB\u5411", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { children: "\u770B\u677F \xB7 \u6982\u89C8" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "mt-1 min-h-0 flex-1 overflow-hidden rounded-[4px] border border-border bg-background", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(AreaChart, { values: GMV, className: "h-full w-full", gridLines: [] }) })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.donut,
            title: "\u6E20\u9053\u6784\u6210",
            type: "chartjs \xB7 doughnut",
            icon: "icon-[lucide--chart-line]",
            inputs: [{ row: 0, tone: TONE.result }],
            outputs: [{ row: 3, tone: TONE.chart }],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u7ED3\u679C\u96C6", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "channel_share" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u7EF4\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "channel" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u6570\u503C", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeSelect, { children: "share \xB7 \u5360\u6BD4" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u8F93\u51FA\u53BB\u5411", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { children: "\u770B\u677F \xB7 \u6982\u89C8" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "mt-1 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                Donut,
                {
                  size: 48,
                  thickness: 9,
                  holeFill: "var(--color-background)",
                  segments: [
                    { value: 46, color: seriesColor(0) },
                    { value: 27, color: seriesColor(1) },
                    { value: 17, color: seriesColor(2) },
                    { value: 10, color: seriesColor(3) }
                  ]
                }
              ) })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          NodeCard,
          {
            ...LAYOUT.out,
            title: "\u770B\u677F\u4EA7\u7269",
            type: "output",
            icon: "icon-[lucide--layout-dashboard]",
            inputs: [
              { row: 0, tone: TONE.chart },
              { row: 1, tone: TONE.chart }
            ],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u6298\u7EBF\u56FE", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { children: "GMV \u8D8B\u52BF" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeRow, { label: "\u73AF\u5F62\u56FE", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(NodeValue, { children: "\u6E20\u9053\u6784\u6210" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "mt-1 grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-1 rounded-[4px] border border-border bg-background p-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "col-span-4 rounded-[2px] bg-neutral-muted" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "col-span-2 row-span-2 rounded-[2px] bg-series-1/30" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "rounded-[2px] bg-neutral-muted" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "rounded-[2px] bg-neutral-muted" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "rounded-[2px] bg-neutral-muted" }),
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "rounded-[2px] bg-neutral-muted" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { className: "mt-1.5 flex h-[26px] shrink-0 items-center justify-center gap-1.5 rounded-control bg-primary text-[11px] font-medium text-primary-foreground", children: [
                /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Icon, { name: "icon-[lucide--play]", className: "size-3" }),
                "\u8FD0\u884C\u753B\u5E03"
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
          "div",
          {
            className: "absolute z-20 flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface-raised px-1 shadow-popover",
            style: { left: LAYOUT.line.x, top: LAYOUT.line.y + LAYOUT.line.h + 8 },
            children: [
              TOOLBOX.map((t) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconButton, { size: "xs", icon: t.icon, title: t.title }, t.title)),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "mx-0.5 h-4 w-px shrink-0 bg-border" }),
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconButton, { size: "xs", tone: "danger", icon: "icon-[lucide--trash-2]", title: "\u5220\u9664\u8282\u70B9" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(AiNodePanel, { x: 16, y: 620, w: 284, h: 232 }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "absolute right-4 bottom-3 h-20 w-28 overflow-hidden rounded-control border border-border bg-background/90 p-1", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "relative h-full w-full", children: Object.keys(LAYOUT).map((id) => {
          const n = LAYOUT[id];
          return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "span",
            {
              className: "absolute rounded-[1px]",
              style: {
                left: `${n.x / 880 * 100}%`,
                top: `${n.y / 864 * 100}%`,
                width: `${n.w / 880 * 100}%`,
                height: `${n.h / 864 * 100}%`,
                background: n.tone,
                opacity: 0.65
              }
            },
            id
          );
        }) }) })
      ]
    }
  );
}

// components/editor/NodeLibrary.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var GROUPS3 = [
  {
    label: "\u6570\u636E\u6E90",
    items: [
      { label: "\u6570\u636E\u96C6", icon: "icon-[lucide--database]" },
      { label: "SQL \u67E5\u8BE2", icon: "icon-[lucide--scroll-text]" },
      { label: "\u7B5B\u9009\u5668", icon: "icon-[lucide--list-filter]" }
    ]
  },
  {
    label: "\u56FE\u8868",
    items: [
      { label: "\u6298\u7EBF\u56FE", kind: "line" },
      { label: "\u67F1\u72B6\u56FE", kind: "column" },
      { label: "\u73AF\u5F62\u56FE", kind: "donut" },
      { label: "\u6F0F\u6597\u56FE", kind: "funnel" },
      { label: "\u6563\u70B9\u56FE", kind: "scatter" },
      { label: "\u6307\u6807\u5361", kind: "metric" }
    ]
  },
  {
    label: "\u63A7\u4EF6",
    items: [
      { label: "\u67E5\u8BE2\u63A7\u4EF6", icon: "icon-[lucide--sliders-horizontal]" },
      { label: "\u6587\u672C", icon: "icon-[lucide--type]" },
      { label: "\u65E5\u671F\u8303\u56F4", icon: "icon-[lucide--calendar-range]" }
    ]
  },
  {
    label: "\u8F93\u51FA",
    items: [
      { label: "\u770B\u677F\u4EA7\u7269", icon: "icon-[lucide--layout-dashboard]" },
      { label: "\u591A\u9875\u770B\u677F", icon: "icon-[lucide--layout-grid]" }
    ]
  },
  {
    label: "\u9AD8\u7EA7\u7EC4\u4EF6",
    items: [
      { label: "\u7EDF\u8BA1\u6458\u8981", icon: "icon-[lucide--zap]", badge: true },
      { label: "\u9875\u7B7E\u5BB9\u5668", icon: "icon-[lucide--layout-grid]", badge: true },
      { label: "\u660E\u7EC6\u8868\u683C", icon: "icon-[lucide--table-2]", badge: true },
      { label: "\u65E5\u671F\u9009\u62E9", icon: "icon-[lucide--calendar-range]", badge: true }
    ]
  }
];
var TOTAL = GROUPS3.reduce((n, g) => n + g.items.length, 0);
var mark = "var(--color-series-1)";
function Thumb({ kind }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("svg", { viewBox: "0 0 18 18", className: "size-[18px] shrink-0", children: [
    kind === "line" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "path",
      {
        d: "M2 13 L7 9 L11 11 L16 5",
        fill: "none",
        stroke: mark,
        strokeWidth: "1.6",
        strokeLinecap: "round"
      }
    ) : null,
    kind === "column" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("path", { d: "M4 13 V9 M9 13 V5 M14 13 V7", stroke: mark, strokeWidth: "2.6", strokeLinecap: "round" }) : null,
    kind === "donut" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "circle",
      {
        cx: "9",
        cy: "9",
        r: "5.5",
        fill: "none",
        stroke: mark,
        strokeWidth: "3",
        strokeDasharray: "24 12"
      }
    ) : null,
    kind === "funnel" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "2", y: "4", width: "14", height: "3", rx: "1", fill: mark, opacity: "0.9" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "4.5", y: "9", width: "9", height: "3", rx: "1", fill: mark, opacity: "0.6" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "7", y: "14", width: "4", height: "3", rx: "1", fill: mark, opacity: "0.35" })
    ] }) : null,
    kind === "scatter" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("circle", { cx: "4", cy: "13", r: "1.5", fill: mark }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("circle", { cx: "8.5", cy: "8.5", r: "1.5", fill: mark }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("circle", { cx: "12.5", cy: "11", r: "1.5", fill: mark }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("circle", { cx: "15", cy: "5", r: "1.5", fill: mark })
    ] }) : null,
    kind === "metric" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "2", y: "4.5", width: "14", height: "2", rx: "1", fill: mark, opacity: "0.4" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "2", y: "9.5", width: "8", height: "4.5", rx: "1", fill: mark })
    ] }) : null
  ] });
}
function NodeLibrary() {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("aside", { className: "flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface-raised", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--layers]", className: "size-3.5 shrink-0 text-muted" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "text-[12px] font-medium text-surface-foreground", children: "\u8282\u70B9\u5E93" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: [
        TOTAL,
        " \u4E2A"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "shrink-0 px-3 py-2", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--search]", className: "size-3.5 shrink-0 text-faint" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] text-faint", children: "\u641C\u7D22\u8282\u70B9" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "shrink-0 font-mono text-[10px] text-faint", children: "\u2318K" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { className: "mx-3 flex shrink-0 items-center gap-2 rounded-control border border-accent/40 bg-accent-soft px-2 py-1.5 text-left", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-4 shrink-0 text-accent" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-[11px] font-medium text-surface-foreground", children: "\u4ECE\u6570\u636E\u96C6\u751F\u6210" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-[10px] text-muted", children: "\u63D2\u4EF6\u5DE5\u4F5C\u53F0\u5DF2\u8FDE\u63A5\u7684\u5E93 \xB7 \u76F4\u63A5\u8D77\u56FE" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--plus]", className: "size-3.5 shrink-0 text-accent" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "mt-1 flex min-h-0 flex-1 flex-col overflow-hidden pb-1", children: GROUPS3.map((g) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex flex-col pt-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-1.5 px-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "text-[10px] text-faint", children: g.label }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "h-px flex-1 bg-border" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "font-mono text-[10px] text-faint", children: g.items.length })
      ] }),
      g.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex h-7 shrink-0 items-center gap-2 px-3", children: [
        "kind" in item ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Thumb, { kind: item.kind }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: item.icon, className: "size-[18px] shrink-0 text-muted" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] text-surface-foreground", children: item.label }),
        item.badge ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "shrink-0 font-mono text-[9px] text-ai", children: "J" }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--plus]", className: "size-3 shrink-0 text-faint" })
      ] }, item.label))
    ] }, g.label)) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex h-9 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[10px] text-faint", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Icon, { name: "icon-[lucide--info]", className: "size-3 shrink-0" }),
      "\u62D6\u5230\u753B\u5E03\u6DFB\u52A0\u8282\u70B9 \xB7 \u53CC\u51FB\u63D2\u5165"
    ] })
  ] });
}

// components/Switch.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
function Switch({
  on,
  disabled
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
    "span",
    {
      className: `inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ${on ? "bg-primary" : "bg-border-strong"}${disabled ? " opacity-40" : ""}`,
      children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "span",
        {
          className: `size-3 rounded-full bg-surface-foreground ${on ? "translate-x-3" : "translate-x-0"}`
        }
      )
    }
  );
}

// components/editor/PropertyInspector.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var TABS = ["\u53C2\u6570", "\u6837\u5F0F", "\u6570\u636E", "\u8F93\u51FA"];
var PREVIEW = [
  { d: "10-08", gmv: "72.4 \u4E07", orders: "412" },
  { d: "10-09", gmv: "69.1 \u4E07", orders: "398" },
  { d: "10-10", gmv: "83.2 \u4E07", orders: "446" }
];
function Group({
  title,
  note,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("section", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "shrink-0 text-[11px] font-medium text-muted", children: title }),
      note ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "ml-auto truncate text-[10px] text-faint", children: note }) : null
    ] }),
    children
  ] });
}
function Row({ k, v, note, plain = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "w-14 shrink-0 truncate text-[11px] text-muted", children: k }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "span",
      {
        className: `min-w-0 flex-1 truncate text-[11px] text-surface-foreground ${plain ? "" : "font-mono"}`,
        children: v
      }
    ),
    note ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "shrink-0 text-[10px] text-faint", children: note }) : null
  ] });
}
function AddButton({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
    "button",
    {
      type: "button",
      className: "flex h-7 shrink-0 items-center justify-center gap-1 rounded-control border border-dashed border-border text-[11px] text-muted",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--plus]", className: "size-3 shrink-0" }),
        label
      ]
    }
  );
}
function PropertyInspector() {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("aside", { className: "flex w-80 shrink-0 flex-col border-l border-border bg-surface-raised", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--sliders-horizontal]", className: "size-3.5 shrink-0 text-muted" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "text-[12px] font-semibold text-surface-foreground", children: "\u8282\u70B9\u53C2\u6570" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "1 \u4E2A\u8282\u70B9\u5DF2\u9009\u4E2D" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--panel-right-close]", title: "\u6536\u8D77\u53C2\u6570\u9762\u677F" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "grid size-7 shrink-0 place-items-center rounded-control bg-accent-soft text-accent", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--chart-line]", className: "size-3.5" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate text-[12px] font-medium text-surface-foreground", children: "\u6298\u7EBF\u56FE \xB7 GMV \u8D8B\u52BF" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate font-mono text-[10px] text-faint", children: "chartjs \xB7 line \xB7 node_7f2a" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--copy]", title: "\u590D\u5236\u8282\u70B9" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", tone: "danger", icon: "icon-[lucide--trash-2]", title: "\u5220\u9664\u8282\u70B9" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "flex h-9 shrink-0 items-stretch border-b border-border px-1.5", children: TABS.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
      "span",
      {
        className: `relative flex items-center px-2.5 text-[12px] ${i === 0 ? "text-surface-foreground" : "text-muted"}`,
        children: [
          t,
          i === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "absolute inset-x-1.5 bottom-0 h-[2px] bg-accent" }) : null
        ]
      },
      t
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Group, { title: "\u8F93\u5165", note: "\u4E0A\u6E38\u8282\u70B9\u63D0\u4F9B", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2 py-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--scroll-text]", className: "size-3.5 shrink-0 text-ai" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate font-mono text-[11px] text-surface-foreground", children: "gmv_14d" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate font-mono text-[10px] text-faint", children: "SQL \u67E5\u8BE2 \xB7 14 \u884C \xD7 2 \u5217 \xB7 10:24" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--refresh-cw]", title: "\u91CD\u65B0\u8FD0\u884C\u4E0A\u6E38" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--x]", title: "\u65AD\u5F00\u8FDE\u63A5" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Group, { title: "\u8F93\u51FA", note: "\u6E32\u67D3\u5230\u770B\u677F", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2 py-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--layout-dashboard]", className: "size-3.5 shrink-0 text-series-2" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate text-[11px] text-surface-foreground", children: "\u770B\u677F \xB7 \u6982\u89C8" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "block truncate font-mono text-[10px] text-faint", children: "\u81EA\u52A8\u5E03\u5C40 \xB7 \u7B2C 2 \u884C \xB7 1 \u4E2A\u4EA7\u7269" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--arrow-right]", title: "\u5B9A\u4F4D\u5230\u4EA7\u7269\u8282\u70B9" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(Group, { title: "\u53C2\u6570", note: "\u6539\u5B8C\u7ACB\u5373\u91CD\u7ED8", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "\u7EF4\u5EA6", v: "d", note: "\u65E5\u671F" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "\u6570\u503C", v: "gmv", note: "\u6C42\u548C" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "\u56FE\u5F62", v: "\u9762\u79EF", plain: true, note: "\u6298\u7EBF / \u9762\u79EF / \u9636\u68AF" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(AddButton, { label: "\u6DFB\u52A0\u53C2\u6570" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Group, { title: "\u7ED3\u679C\u9884\u89C8", note: "\u4E0A\u6E38\u7ED3\u679C\u96C6\u524D 3 \u884C", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex shrink-0 flex-col rounded-control border border-border bg-surface", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center gap-2 border-b border-border px-2 py-1 font-mono text-[10px] text-faint", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "w-16 shrink-0", children: "d" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "min-w-0 flex-1 text-right", children: "gmv" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "w-12 shrink-0 text-right", children: "orders" })
        ] }),
        PREVIEW.map((r) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex items-center gap-2 px-2 py-1 text-[11px]", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "w-16 shrink-0 font-mono text-muted", children: r.d }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "min-w-0 flex-1 text-right font-mono tabular-nums text-surface-foreground", children: r.gmv }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "w-12 shrink-0 text-right font-mono tabular-nums text-muted", children: r.orders })
        ] }, r.d))
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(Group, { title: "\u8282\u70B9\u7B5B\u9009", note: "\u524D\u7AEF\u8FC7\u6EE4 \xB7 \u4E0D\u91CD\u8DD1 SQL", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "channel", v: "\u7B49\u503C\u591A\u9009 3 / 6" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "total_amount", v: "\u2265 100" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(AddButton, { label: "\u6DFB\u52A0\u7B5B\u9009" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(Group, { title: "\u5E03\u5C40", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row, { k: "\u753B\u5E03\u5750\u6807", v: "x 436 \xB7 y 40 \xB7 216 \xD7 222" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "min-w-0 flex-1 text-[11px] text-surface-foreground", children: "\u5438\u9644\u5230\u7F51\u683C" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Switch, { on: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex h-7 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "min-w-0 flex-1 text-[11px] text-surface-foreground", children: "\u9501\u5B9A\u5BBD\u9AD8\u6BD4" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Switch, { on: false })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-1.5 border-t border-border px-3 text-[10px] text-faint", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Icon, { name: "icon-[lucide--zap]", className: "size-3 shrink-0" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "truncate", children: "\u6539\u52A8\u5373\u65F6\u91CD\u7ED8 \xB7 \u4E0D\u56DE\u6570\u636E\u5E93" })
    ] })
  ] });
}

// frames/ai-node.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
function NodeParamsWithAi() {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(NodeLibrary, {}),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(CanvasStrip, {}),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "relative flex min-h-0 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(NodeGraph, {}),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "absolute inset-0 z-20 bg-background/55" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(AiGenerateDialog, { x: 22, y: 60 }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ParamSuggest, { x: 556, y: 226 })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(PropertyInspector, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(EditorStatusBar, {})
  ] });
}

// frames/back-button.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
var STATE_SPECS = [
  { name: "\u9ED8\u8BA4", cls: "text-muted", note: "\u65E0\u5E95\u8272 \xB7 \u56FE\u6807 muted" },
  {
    name: "\u60AC\u505C",
    cls: "bg-neutral-muted text-surface-foreground",
    note: "neutral-muted 40% \xB7 \u56FE\u6807\u63D0\u4EAE"
  },
  {
    name: "\u6309\u4E0B",
    cls: "bg-border-strong text-surface-foreground",
    note: "\u5B9E\u5E95 \xB7 \u4E0D\u4F4D\u79FB\u3001\u4E0D\u7F29\u653E"
  },
  {
    name: "\u805A\u7126",
    cls: "bg-neutral-muted text-surface-foreground shadow-[0_0_0_2px_var(--color-accent-soft)]",
    note: "\u540C\u60AC\u505C + 2px accent \u5916\u73AF"
  },
  { name: "\u4FDD\u5B58\u4E2D", cls: "text-faint", note: "\u7981\u7528 \xB7 \u56FE\u6807 faint" }
];
var SPECS = [
  ["\u547D\u4E2D\u533A", "28 \xD7 28", "size-7\uFF0C\u4E0D\u5C0F\u4E8E 24 \u7684\u53EF\u70B9\u4E0B\u9650"],
  ["\u56FE\u6807", "14 \xD7 14", "lucide arrow-left \xB7 \u7EBF\u5BBD 1.5"],
  ["\u5706\u89D2", "6", "radius-control\uFF0C\u4E0E\u6240\u6709\u63A7\u4EF6\u4E00\u81F4"],
  ["\u5DE6\u4FA7\u8FB9\u8DDD", "12", "\u9876\u680F px-3\uFF0C\u4E0E\u53F3\u7AEF\u6309\u94AE\u7C07\u5BF9\u79F0"],
  ["\u4E0E\u7AD6\u7EBF\u95F4\u8DDD", "8", "gap-2"],
  ["\u7AD6\u7EBF", "1 \xD7 20", "border \u8272\uFF0C\u5206\u9694\u51FA\u53E3\u4E0E\u770B\u677F\u6807\u9898"],
  ["\u9876\u680F\u9AD8", "48", "h-12\uFF0C\u6309\u94AE\u5782\u76F4\u5C45\u4E2D"]
];
var BEHAVIORS = [
  ["\u70B9\u51FB", "\u56DE\u5230\u300CBI \u6570\u636E\u8D44\u4EA7\u300D\u5217\u8868\uFF0C\u9000\u51FA\u5F53\u524D\u770B\u677F"],
  ["\u6709\u672A\u4FDD\u5B58", "\u5148\u62E6\u622A\uFF1A\u4FDD\u5B58\u5E76\u79BB\u5F00 / \u4E0D\u4FDD\u5B58\u79BB\u5F00 / \u53D6\u6D88"],
  ["\u952E\u76D8", "\u2318[ \u4E0E\u70B9\u51FB\u7B49\u6548\uFF1B\u2318S \u53EA\u4FDD\u5B58\u3001\u4E0D\u79BB\u5F00"],
  ["\u56DE\u5230\u54EA\u91CC", "\u5217\u8868\u4FDD\u7559\u4E0A\u6B21\u7684\u641C\u7D22\u3001\u7B5B\u9009\u4E0E\u9875\u7801"],
  ["\u65E0\u969C\u788D", "title \u5373 aria-label\u300C\u8FD4\u56DE BI \u6570\u636E\u8D44\u4EA7\u300D"]
];
var EXITS = [
  ["\u4FDD\u5B58\u4E2D", "\u6309\u94AE\u8F6C faint \u4E14\u5FFD\u7565\u70B9\u51FB \u2014\u2014 \u534A\u4FDD\u5B58\u72B6\u6001\u4E0B\u79BB\u5F00\u4F1A\u4E22\u6539\u52A8"],
  ["\u6709\u672A\u4FDD\u5B58", "\u5148\u4E09\u9009\u4E00\uFF1A\u4FDD\u5B58\u5E76\u79BB\u5F00 / \u4E0D\u4FDD\u5B58\u79BB\u5F00 / \u53D6\u6D88\uFF0C\u9ED8\u8BA4\u805A\u7126\u7B2C\u4E00\u9879"],
  ["\u4ECE\u4EA7\u7269\u8FDB\u6765", "\u540C\u4E00\u9897\u6309\u94AE\u56DE\u5230\u4EA7\u7269\u5217\u8868\uFF0C\u4E0D\u56DE BI \u8D44\u4EA7 \u2014\u2014 \u6765\u5904\u5373\u53BB\u5904"]
];
var TICKS = [0, 12, 40, 48];
var MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
function DimBand() {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("svg", { viewBox: "0 0 1360 30", className: "h-[30px] w-full", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "0", y1: "10", x2: "48", y2: "10", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    TICKS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "line",
      {
        x1: t,
        y1: "5",
        x2: t,
        y2: "15",
        stroke: "var(--color-border-strong)",
        strokeWidth: "1"
      },
      t
    )),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "text",
      {
        x: "6",
        y: "27",
        textAnchor: "middle",
        fontSize: "9",
        fill: "var(--color-faint)",
        fontFamily: MONO,
        children: "12"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "text",
      {
        x: "26",
        y: "27",
        textAnchor: "middle",
        fontSize: "9",
        fill: "var(--color-faint)",
        fontFamily: MONO,
        children: "28"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "48", y1: "15", x2: "70", y2: "24", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("text", { x: "74", y: "27", fontSize: "9", fill: "var(--color-faint)", fontFamily: MONO, children: "\u7AD6\u7EBF 1 \xD7 20 \xB7 \u5DE6\u53F3\u5404 8 \u2192 \u770B\u677F\u6807\u9898" })
  ] });
}
function Zoom() {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("svg", { viewBox: "0 0 104 112", className: "h-[112px] w-[104px] shrink-0", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("text", { x: "8", y: "9", fontSize: "9", fill: "var(--color-faint)", fontFamily: MONO, children: "2\xD7" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "rect",
      {
        x: "8",
        y: "16",
        width: "56",
        height: "56",
        rx: "12",
        stroke: "var(--color-accent)",
        strokeWidth: "1.5"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
      "g",
      {
        transform: "translate(22 30) scale(1.1667)",
        stroke: "var(--color-surface-foreground)",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("path", { d: "M19 12H5" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("path", { d: "m12 19-7-7 7-7" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "8", y1: "80", x2: "64", y2: "80", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "8", y1: "76", x2: "8", y2: "84", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "64", y1: "76", x2: "64", y2: "84", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "text",
      {
        x: "36",
        y: "98",
        textAnchor: "middle",
        fontSize: "9",
        fill: "var(--color-faint)",
        fontFamily: MONO,
        children: "28"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "74", y1: "16", x2: "74", y2: "72", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "70", y1: "16", x2: "78", y2: "16", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("line", { x1: "70", y1: "72", x2: "78", y2: "72", stroke: "var(--color-border-strong)", strokeWidth: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("text", { x: "82", y: "44", fontSize: "9", fill: "var(--color-faint)", fontFamily: MONO, children: "28" })
  ] });
}
function SectionTitle({ title, note }) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex shrink-0 items-baseline gap-2.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h2", { className: "text-[13px] font-semibold text-surface-foreground", children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[11px] text-faint", children: note })
  ] });
}
function BackButton() {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("header", { className: "flex shrink-0 items-start gap-6 border-b border-border px-10 pt-7 pb-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "min-w-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[11px] tracking-wide text-accent", children: "\u9876\u680F \xB7 \u6700\u5DE6\u7AEF" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("h1", { className: "mt-2 text-[22px] leading-tight font-semibold", children: "\u8FD4\u56DE\u6309\u94AE" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: "mt-2 max-w-[720px] text-[13px] leading-relaxed text-muted", children: "\u7F16\u8F91\u5668\u91CC\u552F\u4E00\u4E00\u4E2A\u4E0D\u4FEE\u6539\u8FD9\u4EFD\u770B\u677F\u7684\u6309\u94AE\uFF1A\u5B83\u79BB\u5F00\u300228 \xD7 28 \u547D\u4E2D\u533A\u300114px \u56FE\u6807\uFF0C \u4E0E\u770B\u677F\u6807\u9898\u4E4B\u95F4\u9694\u4E00\u6761 20px \u9AD8\u7684\u7AD6\u7EBF \u2014\u2014 \u51FA\u53E3\u548C\u5176\u5B83\u6539\u52A8\u52A8\u4F5C\u5728\u89C6\u89C9\u4E0A\u5FC5\u987B\u5206\u5F00\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "ml-auto flex shrink-0 flex-col items-end gap-1 pt-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[11px] text-faint", children: 'IconButton \xB7 size="sm"' }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[11px] text-faint", children: "lucide arrow-left" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[11px] text-faint", children: "\u51FA\u73B0\u5728 frames/editor" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-10 py-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("section", { className: "flex shrink-0 flex-col gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SectionTitle, { title: "\u4E0A\u4E0B\u6587", note: "\u9876\u680F\u5DE6\u7AEF 1:1 \xB7 \u5C3A\u5BF8\u7EBF\u5BF9\u9F50\u771F\u5B9E\u5750\u6807" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "overflow-hidden rounded-card border border-border bg-surface", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(EditorToolbar, {}),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(DimBand, {})
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("section", { className: "flex shrink-0 flex-col gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SectionTitle, { title: "\u72B6\u6001", note: "\u821E\u53F0\u5E95\u8272 = \u9876\u680F\u5E95\u8272 surface-raised" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "grid grid-cols-5 gap-3", children: STATE_SPECS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
          "div",
          {
            className: "flex flex-col gap-2 rounded-card border border-border bg-surface p-3",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "grid h-[72px] place-items-center rounded-control border border-border bg-surface-raised", children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                "span",
                {
                  className: `grid size-7 place-items-center rounded-control ${s.cls}`,
                  children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Icon, { name: "icon-[lucide--arrow-left]", className: "size-3.5" })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "text-[12px] font-medium", children: s.name }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "font-mono text-[10px] leading-relaxed text-faint", children: s.note })
            ]
          },
          s.name
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("section", { className: "flex shrink-0 flex-col gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SectionTitle, { title: "\u51FA\u53E3\u7684\u8FB9\u754C", note: "\u5B83\u4E0D\u4FEE\u6539\u770B\u677F\uFF0C\u53EA\u8D1F\u8D23\u79BB\u5F00" }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "grid grid-cols-3 gap-3", children: EXITS.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex flex-col gap-1.5 rounded-card border border-border bg-surface p-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "text-[12px] font-medium", children: k }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "text-[11px] leading-relaxed text-muted", children: v })
        ] }, k)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("section", { className: "grid min-h-0 flex-1 grid-cols-12 gap-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "col-span-7 flex flex-col gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SectionTitle, { title: "\u5C3A\u5BF8\u4E0E\u95F4\u8DDD", note: "\u5355\u4F4D px \xB7 \u5168\u90E8\u6765\u81EA\u9876\u680F\u5B9E\u9645\u6392\u5E03" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex flex-1 items-start gap-6", children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Zoom, {}),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "flex min-w-0 flex-1 flex-col", children: SPECS.map(([k, v, note]) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex items-baseline gap-3 py-[7px]", children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "w-16 shrink-0 text-[11px] text-faint", children: k }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "w-20 shrink-0 font-mono text-[12px] tabular-nums text-surface-foreground", children: v }),
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "truncate text-[11px] text-muted", children: note })
            ] }, k)) })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "col-span-5 flex flex-col gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SectionTitle, { title: "\u884C\u4E3A", note: "\u70B9\u51FB\u4E4B\u540E\u53D1\u751F\u4EC0\u4E48" }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "flex flex-col", children: BEHAVIORS.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "flex items-baseline gap-3 py-[7px]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "w-16 shrink-0 text-[11px] text-faint", children: k }),
            /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "min-w-0 flex-1 text-[12px] leading-relaxed text-muted", children: v })
          ] }, k)) })
        ] })
      ] })
    ] })
  ] });
}

// frames/bigscreen.tsx
var import_jsx_runtime20 = require("react/jsx-runtime");
var RAIL = [
  { icon: "icon-[lucide--monitor]", label: "\u5927\u5C4F\u6807\u9898", count: "1", on: false },
  { icon: "icon-[lucide--activity]", label: "\u5927\u5C4F\u6307\u6807\u5361", count: "4", on: true },
  { icon: "icon-[lucide--chart-line]", label: "\u5927\u5C4F\u6298\u7EBF", count: "1", on: false },
  { icon: "icon-[lucide--filter]", label: "\u5927\u5C4F\u6F0F\u6597", count: "1", on: false },
  { icon: "icon-[lucide--list-ordered]", label: "\u5927\u5C4F\u6392\u884C\u699C", count: "1", on: false },
  { icon: "icon-[lucide--layout-dashboard]", label: "\u5927\u5C4F\u8F6E\u64AD", count: "\u2014", on: false }
];
var KPIS = [
  { label: "GMV \xB7 \u8FD1 14 \u5929", value: "1 286 \u4E07", delta: "+18.4%", up: true },
  { label: "\u8BA2\u5355\u91CF", value: "42 186", delta: "+6.2%", up: true },
  { label: "\u5BA2\u5355\u4EF7", value: "305", delta: "-1.8%", up: false },
  { label: "\u65B0\u5BA2\u5360\u6BD4", value: "34%", delta: "+4.1%", up: true }
];
var GMV2 = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
var X = ["9-28", "9-30", "10-02", "10-04", "10-06", "10-08", "10-10"];
var STAGES = [
  { label: "\u66DD\u5149", value: 100, text: "1 240 \u4E07" },
  { label: "\u70B9\u51FB", value: 62, text: "768 \u4E07" },
  { label: "\u52A0\u8D2D", value: 34, text: "412 \u4E07" },
  { label: "\u4E0B\u5355", value: 18, text: "218 \u4E07" }
];
var RANK = [
  { name: "\u6296\u97F3", value: 100, text: "426 \u4E07" },
  { name: "\u5929\u732B", value: 78, text: "332 \u4E07" },
  { name: "\u4EAC\u4E1C", value: 54, text: "228 \u4E07" },
  { name: "\u5C0F\u7EA2\u4E66", value: 37, text: "158 \u4E07" },
  { name: "\u7EBF\u4E0B\u95E8\u5E97", value: 21, text: "92 \u4E07" }
];
var PARAMS = [
  ["\u5EA6\u91CF", "gmv \xB7 sum"],
  ["\u5355\u4F4D", "\u4E07\u5143 \xB7 1 \u4F4D\u5C0F\u6570"],
  ["\u9608\u503C", "\u4F4E\u4E8E 60 \u6807\u9EC4 \xB7 \u9AD8\u4E8E 100 \u6807\u7EFF"],
  ["\u52A8\u6548", "\u6570\u5B57\u6EDA\u52A8 600 ms"]
];
var SETTINGS = [
  ["\u5206\u8FA8\u7387", "1920 \xD7 1080 \xB7 16:9"],
  ["\u80CC\u666F", "\u6DF1\u8272\u6E10\u53D8 \xB7 \u5185\u7F6E\u7B2C 2 \u5957"],
  ["\u81EA\u52A8\u5237\u65B0", "5 \u5206\u949F"],
  ["\u8F6E\u64AD", "3 \u9875 \xB7 \u95F4\u9694 15s"]
];
function BigScreen() {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("header", { className: "flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--monitor]", className: "size-4 shrink-0 text-accent" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u6E20\u9053\u7ECF\u8425\u5927\u5C4F" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Chip, { tone: "accent", children: "\u5927\u5C4F \xB7 1920 \xD7 1080" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Chip, { children: "1 \u9875 \xB7 8 \u4E2A\u8282\u70B9" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "sm", variant: "ghost", icon: "icon-[lucide--share-2]", children: "\u5206\u4EAB" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "sm", variant: "default", icon: "icon-[lucide--play]", children: "\u9884\u89C8" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--upload]", children: "\u53D1\u5E03\u5230\u5DE5\u4F5C\u6811" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("aside", { className: "flex w-60 shrink-0 flex-col border-r border-border bg-surface-raised", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex h-10 shrink-0 items-center gap-2 border-b border-border px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--boxes]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[12px] font-medium text-surface-foreground", children: "\u5927\u5C4F\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "6 \u79CD" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex flex-col gap-0.5 px-2 py-2", children: RAIL.map((r) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
          "div",
          {
            className: `flex h-7 items-center gap-2 rounded-[4px] px-2 ${r.on ? "bg-accent-soft" : ""}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: r.icon, className: `size-3.5 shrink-0 ${r.on ? "text-accent" : "text-muted"}` }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: `text-[11px] ${r.on ? "text-accent" : "text-surface-foreground"}`, children: r.label }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: r.count })
            ]
          },
          r.label
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "mt-auto border-t border-border px-3 py-3 text-[10px] leading-4 text-faint", children: "\u5927\u5C4F\u8282\u70B9\u4E0E\u770B\u677F\u8282\u70B9\u540C\u4E00\u5957\u8FD0\u884C\u8D26\uFF0C\u53EA\u662F\u5B57\u53F7\u3001\u95F4\u8DDD\u6309\u6295\u5C4F 3 \u500D\u91CD\u6392\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--monitor]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] text-muted", children: "\u753B\u5E03 1920 \xD7 1080" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Chip, { mono: true, children: "\u7F29\u653E 42%" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--grid-2x2]", className: "size-3 shrink-0" }),
            "\u5438\u9644\u5DF2\u5F00"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--sliders-horizontal]", className: "size-3 shrink-0" }),
            "\u5B89\u5168\u533A\u53C2\u8003\u7EBF"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "xs", variant: "ghost", children: "\u9002\u914D\u89C6\u56FE" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--minus]", title: "\u7F29\u5C0F" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--plus]", title: "\u653E\u5927" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex min-h-0 flex-1 items-center justify-center bg-screen p-6", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "aspect-[16/9] w-[864px] max-w-full overflow-hidden rounded-card border border-screen-line bg-screen p-4", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "grid h-full grid-cols-12 grid-rows-[52px_120px_1fr] gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "col-span-12 flex items-center gap-4 border-b border-screen-line", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "h-px flex-1 bg-screen-line" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[24px] font-semibold tracking-wide text-screen-foreground", children: "\u6E20\u9053\u7ECF\u8425\u5927\u5C4F" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "h-px flex-1 bg-screen-line" })
          ] }),
          KPIS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
            "div",
            {
              className: "col-span-3 flex flex-col justify-center rounded-card border border-screen-line px-3",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] text-screen-foreground/70", children: k.label }),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "font-mono text-[32px] leading-tight tabular-nums text-screen-foreground", children: k.value }),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { className: `text-[11px] ${k.up ? "text-success" : "text-danger"}`, children: [
                  k.delta,
                  " \u73AF\u6BD4\u4E0A\u671F"
                ] })
              ]
            },
            k.label
          )),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "col-span-5 flex flex-col rounded-card border border-screen-line px-3 py-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex shrink-0 items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "size-2 shrink-0 rounded-full bg-series-1" }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] text-screen-foreground/70", children: "GMV \u8D8B\u52BF \xB7 \u8FD1 14 \u5929" }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "ml-auto font-mono text-[10px] text-screen-foreground/50", children: "\u534E\u4E1C \xB7 \u6296\u97F3" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "min-h-0 flex-1 pt-1", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(AreaChart, { values: GMV2, className: "h-full w-full" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex shrink-0 items-center justify-between pt-1", children: X.map((t) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "font-mono text-[9px] text-screen-foreground/50", children: t }, t)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "col-span-3 flex flex-col rounded-card border border-screen-line px-3 py-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "shrink-0 text-[11px] text-screen-foreground/70", children: "\u8F6C\u5316\u6F0F\u6597" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "min-h-0 flex-1 pt-1", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Funnel, { stages: STAGES, className: "h-full w-full" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "col-span-4 flex flex-col rounded-card border border-screen-line px-3 py-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "shrink-0 text-[11px] text-screen-foreground/70", children: "\u6E20\u9053\u6392\u884C \xB7 \u524D 5" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex min-h-0 flex-1 flex-col justify-center gap-1.5 pt-1", children: RANK.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "w-3 shrink-0 font-mono text-[10px] text-screen-foreground/50", children: i + 1 }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "w-12 shrink-0 text-[11px] text-screen-foreground", children: r.name }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "h-2 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-screen-line", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                "span",
                {
                  className: "block h-full rounded-[2px] bg-series-1",
                  style: { width: `${r.value}%` }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-screen-foreground/70", children: r.text })
            ] }, r.name)) })
          ] })
        ] }) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("aside", { className: "flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--activity]", className: "size-3.5 shrink-0 text-accent" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u8282\u70B9\u53C2\u6570 \xB7 \u5927\u5C4F\u6307\u6807\u5361" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2", children: PARAMS.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "w-[46px] shrink-0 truncate text-[10px] text-muted", children: k }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "min-w-0 flex-1 truncate text-[10px] text-surface-foreground", children: v })
          ] }, k)) }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[10px] text-faint", children: "\u9009\u4E2D\u753B\u5E03\u4E0A\u7684 4 \u5F20\u5361\u4F1A\u4E00\u8D77\u6539\uFF0C\u5B83\u4EEC\u5171\u7528\u540C\u4E00\u7EC4\u53C2\u6570\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex flex-col gap-2 border-t border-border pt-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--settings]", className: "size-3.5 shrink-0 text-muted" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u5927\u5C4F\u8BBE\u7F6E" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2", children: SETTINGS.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "w-[46px] shrink-0 truncate text-[10px] text-muted", children: k }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "min-w-0 flex-1 truncate text-[10px] text-surface-foreground", children: v })
          ] }, k)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { name: "icon-[lucide--link-2]", className: "size-3.5 shrink-0 text-muted" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u5927\u5C4F\u94FE\u63A5" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u53EA\u8BFB" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "truncate font-mono text-[10px] text-muted", children: "bi.local/screen/chan-ops-8c41" }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "xs", variant: "ghost", icon: "icon-[lucide--copy]", className: "self-start", children: "\u590D\u5236" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("footer", { className: "flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip bg-neutral-muted px-2 text-[10px] text-muted", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-success" }),
        "\u5927\u5C4F 1 \u9875 \xB7 8 \u4E2A\u8282\u70B9 \xB7 1920 \xD7 1080"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "text-[11px] text-muted", children: "\u5927\u5C4F\u4E0E\u770B\u677F\u5171\u7528\u540C\u4E00\u672C\u8FD0\u884C\u8D26\uFF0C\u4EA7\u7269\u90FD\u6709\u72EC\u7ACB\u94FE\u63A5" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Chip, { icon: "icon-[lucide--clock]", children: "\u81EA\u52A8\u5237\u65B0 5 \u5206\u949F" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--play]", children: "\u6574\u4F53\u8FD0\u884C" })
      ] })
    ] })
  ] });
}

// components/editor/CanvasTiles.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
var GMV_14D = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
var GMV_PREV = [38, 44, 41, 49, 47, 55, 52, 60, 57, 64, 62, 70, 67, 74];
var X_LABELS = ["09-27", "10-01", "10-05", "10-10"];
var Y_TICKS = ticks(0, 90, 4);
var GMV_DOMAIN = [0, 90];
var METRICS = [
  { label: "GMV", unit: "\u5143", value: "2,847,300", delta: "+12.4%", up: true, spark: [42, 48, 45, 55, 51, 61, 58, 66, 74, 83] },
  { label: "\u8BA2\u5355\u91CF", unit: "\u5355", value: "18,472", delta: "+6.1%", up: true, spark: [18, 22, 20, 26, 24, 29, 27, 32, 30, 38] },
  { label: "\u5BA2\u5355\u4EF7", unit: "\u5143", value: "154.2", delta: "\u22122.3%", up: false, spark: [168, 165, 162, 166, 160, 157, 159, 155, 152, 154] },
  { label: "\u9000\u6B3E\u7387", unit: "", value: "3.8%", delta: "+0.4pt", up: false, spark: [3.1, 3.2, 3, 3.4, 3.3, 3.5, 3.6, 3.5, 3.7, 3.8] }
];
var CHANNELS = [
  { label: "\u81EA\u7136\u6D41\u91CF", value: 46, color: seriesColor(0) },
  { label: "\u641C\u7D22\u5E7F\u544A", value: 27, color: seriesColor(1) },
  { label: "\u793E\u4EA4\u6295\u653E", value: 17, color: seriesColor(2) },
  { label: "\u8001\u5BA2\u590D\u8D2D", value: 10, color: seriesColor(3) }
];
var CITIES = [
  { label: "\u676D\u5DDE", value: 228410, text: "228,410" },
  { label: "\u4E0A\u6D77", value: 176930, text: "176,930" },
  { label: "\u5317\u4EAC", value: 144220, text: "144,220" },
  { label: "\u6210\u90FD", value: 99860, text: "99,860" },
  { label: "\u5E7F\u5DDE", value: 77540, text: "77,540" }
];
var FUNNEL = [
  { label: "\u66DD\u5149", value: 100, text: "100%" },
  { label: "\u8BE6\u60C5\u9875", value: 42, text: "42%" },
  { label: "\u52A0\u8D2D", value: 21, text: "21%" },
  { label: "\u4E0B\u5355", value: 12, text: "12%" },
  { label: "\u652F\u4ED8", value: 8.6, text: "8.6%" }
];
var FILTERS = [
  { label: "\u65F6\u95F4", value: "\u8FD1 30 \u5929" },
  { label: "\u6E20\u9053", value: "3 / 6 \u5DF2\u9009" },
  { label: "\u57CE\u5E02", value: "\u5305\u542B \u676D\u5DDE" },
  { label: "\u54C1\u7C7B", value: "\u5168\u90E8" }
];
var ORDER_ROWS = [
  { id: "SO-20481", city: "\u676D\u5DDE", cat: "\u6570\u7801\u914D\u4EF6", amt: "\xA52,480", at: "10-10 18:42" },
  { id: "SO-20476", city: "\u4E0A\u6D77", cat: "\u5BB6\u7528\u7535\u5668", amt: "\xA51,960", at: "10-10 17:05" },
  { id: "SO-20468", city: "\u5317\u4EAC", cat: "\u6237\u5916\u8FD0\u52A8", amt: "\xA51,348", at: "10-10 15:31" },
  { id: "SO-20461", city: "\u6210\u90FD", cat: "\u7F8E\u5986\u4E2A\u62A4", amt: "\xA5899", at: "10-10 14:12" },
  { id: "SO-20455", city: "\u5E7F\u5DDE", cat: "\u98DF\u54C1\u751F\u9C9C", amt: "\xA5612", at: "10-10 11:48" }
];
function Tile({
  children,
  selected = false,
  label,
  className = ""
}) {
  const dot = "absolute size-1.5 rounded-[1px] border border-background bg-accent";
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
    "div",
    {
      className: `relative flex min-w-0 flex-col rounded-card border bg-surface ${selected ? "border-accent" : "border-border"} ${className}`,
      children: [
        children,
        selected ? /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
          label ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "absolute -top-6 left-0 flex h-5 items-center gap-1.5 rounded-chip bg-accent px-1.5 font-mono text-[10px] tabular-nums whitespace-nowrap text-accent-foreground", children: label }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -top-[3px] -left-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -top-[3px] left-1/2 -ml-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -top-[3px] -right-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} top-1/2 -left-[3px] -mt-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} top-1/2 -right-[3px] -mt-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -bottom-[3px] -left-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -bottom-[3px] left-1/2 -ml-[3px]` }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${dot} -right-[3px] -bottom-[3px]` })
        ] }) : null
      ]
    }
  );
}
function TileHead({
  title,
  meta,
  legend,
  tint = false
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
    "div",
    {
      className: `flex h-8 shrink-0 items-center gap-2 border-b px-2.5 ${tint ? "border-accent/40 bg-accent-soft" : "border-border"}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate text-[12px] font-medium text-surface-foreground", children: title }),
        meta ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "shrink-0 font-mono text-[10px] text-faint", children: meta }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
          legend?.map((l) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-center gap-1 text-[10px] text-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
              "span",
              {
                className: `size-2 shrink-0 rounded-[1px] ${l.dash ? "border-t-2 border-dashed" : ""}`,
                style: l.dash ? { borderColor: l.color } : { background: l.color }
              }
            ),
            l.label
          ] }, l.label)),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--ellipsis]", className: "size-3.5 text-faint" })
        ] })
      ]
    }
  );
}
function MetricTile({ metric, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Tile, { className, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex h-20 flex-col justify-between px-2.5 py-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-[11px] whitespace-nowrap text-muted", children: metric.label }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-end gap-1.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-[20px] leading-none font-semibold tabular-nums text-surface-foreground", children: metric.value }),
      metric.unit ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "pb-0.5 text-[11px] text-faint", children: metric.unit }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Sparkline,
        {
          values: metric.spark,
          stroke: metric.up ? seriesColor(0) : seriesColor(3),
          className: "ml-auto h-4 w-8 shrink-0"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-center gap-1.5 text-[10px] whitespace-nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Chip, { tone: metric.up ? "primary" : "danger", mono: true, children: metric.delta }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-faint", children: "\u73AF\u6BD4\u4E0A\u5468\u671F" })
    ] })
  ] }) });
}
function CanvasTiles({ preview = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MetricTile, { metric: METRICS[0], className: "col-span-3 col-start-1 row-start-1" }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MetricTile, { metric: METRICS[1], className: "col-span-3 col-start-4 row-start-1" }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MetricTile, { metric: METRICS[2], className: "col-span-3 col-start-7 row-start-1" }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MetricTile, { metric: METRICS[3], className: "col-span-3 col-start-10 row-start-1" }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
      Tile,
      {
        selected: !preview,
        label: preview ? void 0 : "GMV \u8D8B\u52BF \xB7 \u7B2C 1\u20138 \u5217 \xB7 \u7B2C 2 \u884C \xB7 528 \xD7 248",
        className: "col-span-8 col-start-1 row-start-2",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
            TileHead,
            {
              title: "GMV \u8D8B\u52BF",
              meta: "orders_daily",
              tint: true,
              legend: [
                { label: "\u672C\u671F", color: seriesColor(0) },
                { label: "\u4E0A\u5468\u671F", color: seriesColor(2), dash: true }
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex min-h-0 flex-1 gap-1.5 px-2.5 pt-3 pb-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "relative w-7 shrink-0", children: Y_TICKS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
              "span",
              {
                className: "absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-faint",
                style: { top: `${yPercent(t, GMV_DOMAIN[0], GMV_DOMAIN[1])}%` },
                children: [
                  t,
                  "\u4E07"
                ]
              },
              t
            )) }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "relative min-w-0 flex-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
                AreaChart,
                {
                  values: GMV_14D,
                  domain: GMV_DOMAIN,
                  gridLines: Y_TICKS.map((t) => yPercent(t, GMV_DOMAIN[0], GMV_DOMAIN[1])),
                  className: "absolute inset-0 h-full w-full"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
                AreaChart,
                {
                  values: GMV_PREV,
                  domain: GMV_DOMAIN,
                  grid: false,
                  fill: "transparent",
                  stroke: seriesColor(2),
                  dash: true,
                  className: "absolute inset-0 h-full w-full"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex shrink-0 items-center justify-between border-t border-border pt-1 pr-2.5 pb-1.5 pl-[44px] font-mono text-[10px] text-faint", children: X_LABELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: l }, l)) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-4 col-start-9 row-start-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u6E20\u9053\u6784\u6210", meta: "channel_share" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex min-h-0 flex-1 items-center gap-3 px-3 pt-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Donut, { segments: CHANNELS, size: 92, thickness: 13 }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex min-w-0 flex-1 flex-col gap-1.5", children: CHANNELS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-center gap-1.5 text-[11px] whitespace-nowrap", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "size-2 shrink-0 rounded-[1px]", style: { background: c.color } }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate text-muted", children: c.label }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "ml-auto font-mono tabular-nums text-surface-foreground", children: [
            c.value,
            "%"
          ] })
        ] }, c.label)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--filter]", className: "size-3 shrink-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: "\u53E3\u5F84\uFF1A\u5DF2\u652F\u4ED8\u8BA2\u5355\u91D1\u989D\u5360\u6BD4 \xB7 \u53BB\u91CD\u5BA2\u6237" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-5 col-start-1 row-start-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u57CE\u5E02 Top 5", meta: "city_top20" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex min-h-0 flex-1 flex-col justify-center px-2.5", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(HBars, { rows: CITIES }) }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--trending-up]", className: "size-3 shrink-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: "\u53E3\u5F84\uFF1A\u8FD1 30 \u5929\u5DF2\u652F\u4ED8\u91D1\u989D \xB7 \u5355\u4F4D\u5143" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-4 col-start-6 row-start-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u8F6C\u5316\u6F0F\u6597", meta: "orders_daily" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex min-h-0 flex-1 flex-col justify-center gap-1 px-2.5", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Funnel, { stages: FUNNEL }) }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--info]", className: "size-3 shrink-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: "\u4EBA\u6570\u53E3\u5F84\uFF0C\u4E0E\u8BA2\u5355\u53E3\u5F84\u4E0D\u901A\u7528" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-3 col-start-10 row-start-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u67E5\u8BE2\u63A7\u4EF6", meta: "\u589E\u5F3A" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex min-h-0 flex-1 flex-col justify-center gap-2 px-2.5", children: FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "w-7 shrink-0 text-[10px] text-muted", children: f.label }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex h-6 min-w-0 flex-1 items-center gap-1 rounded-control border border-border bg-surface px-1.5 text-[10px] text-surface-foreground", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: f.value }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "ml-auto size-3 shrink-0 text-faint" })
        ] })
      ] }, f.label)) }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-1.5 border-t border-border px-2.5 text-[10px] text-faint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Icon, { name: "icon-[lucide--zap]", className: "size-3 shrink-0" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: "\u6539\u52A8\u5373\u65F6\u751F\u6548 \xB7 \u4E0D\u91CD\u8DD1 SQL" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-8 col-start-1 row-start-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u8BA2\u5355\u660E\u7EC6", meta: "orders_daily" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col px-2.5 py-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "grid shrink-0 grid-cols-[76px_1fr_1fr_64px_1fr] gap-2 border-b border-border pb-1.5 text-[10px] text-faint", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: "\u8BA2\u5355\u53F7" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: "\u57CE\u5E02" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: "\u54C1\u7C7B" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-right", children: "\u91D1\u989D" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-right", children: "\u652F\u4ED8\u65F6\u95F4" })
        ] }),
        ORDER_ROWS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
          "div",
          {
            className: "grid min-h-0 flex-1 grid-cols-[76px_1fr_1fr_64px_1fr] items-center gap-2 text-[11px]",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate font-mono text-muted", children: r.id }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate text-surface-foreground", children: r.city }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate text-muted", children: r.cat }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-right font-mono tabular-nums text-surface-foreground", children: r.amt }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-right font-mono tabular-nums text-faint", children: r.at })
            ]
          },
          r.id
        ))
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Tile, { className: "col-span-4 col-start-9 row-start-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TileHead, { title: "\u76EE\u6807\u5B8C\u6210\u5EA6", meta: "\u589E\u5F3A" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "relative", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Gauge, { value: 82 }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "absolute inset-x-0 bottom-0 text-center text-[16px] font-semibold tabular-nums text-surface-foreground", children: "82%" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex w-full flex-col gap-1.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-muted", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "h-1.5 rounded-full bg-series-1", style: { width: "82%" } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "flex items-center gap-1.5 text-[10px] whitespace-nowrap text-faint", children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "truncate", children: "\u6708\u5EA6\u76EE\u6807 \xA53.5M" }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "ml-auto font-mono tabular-nums text-muted", children: "\u5DF2\u5B8C\u6210 \xA52.87M" })
          ] })
        ] })
      ] })
    ] })
  ] });
}

// frames/dashboard.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
var PAGES2 = [
  { name: "\u6982\u89C8", active: true },
  { name: "\u6E20\u9053\u660E\u7EC6", active: false },
  { name: "\u57CE\u5E02\u5206\u5E03", active: false }
];
function Dashboard() {
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("header", { className: "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(IconButton, { icon: "icon-[lucide--arrow-left]", title: "\u8FD4\u56DE\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "truncate text-[15px] font-semibold text-surface-foreground", children: "\u6E20\u9053\u7ECF\u8425\u770B\u677F" }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Chip, { children: "\u4EA7\u7269" }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "font-mono text-[11px] tabular-nums whitespace-nowrap text-faint", children: "\u8FD0\u884C\u4E8E 10:24 \xB7 1.2s \xB7 \u7531 6 \u4E2A\u8282\u70B9\u751F\u6210" }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "flex shrink-0 items-center gap-1", children: PAGES2.map((p) => /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
          "span",
          {
            className: `flex h-7 shrink-0 items-center rounded-control border px-2.5 text-[12px] whitespace-nowrap ${p.active ? "border-border bg-surface font-medium text-surface-foreground" : "border-transparent text-muted"}`,
            children: p.name
          },
          p.name
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "h-5 w-px shrink-0 bg-border" }),
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(IconButton, { icon: "icon-[lucide--refresh-cw]", title: "\u91CD\u65B0\u8FD0\u884C" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-6", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "relative min-h-0 w-full flex-1 rounded-card border border-border-strong bg-surface", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "relative grid h-full grid-cols-12 grid-rows-[80px_248px_216px_1fr] gap-3 p-4", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(CanvasTiles, { preview: true }) }) }) })
  ] });
}

// frames/data.tsx
var import_jsx_runtime23 = require("react/jsx-runtime");
var CONNECTED = [
  { icon: "icon-[lucide--database]", name: "\u751F\u4EA7\u5E93 MySQL", note: "14 \u8868 \xB7 \u76F4\u8FDE", on: true },
  { icon: "icon-[lucide--upload]", name: "\u672C\u5730\u6587\u4EF6", note: "3 \u4E2A \xB7 \u4F1A\u8BDD\u7EA7", on: false }
];
var DATASETS = [
  { name: "ds_orders", note: "12 486 \u884C" },
  { name: "ds_channels", note: "6 \u884C" },
  { name: "ds_city", note: "312 \u884C" },
  { name: "ds_campaign", note: "\u62D6\u5165 CSV \u751F\u6210" }
];
var CONSUMERS = [
  { name: "line_gmv_14d", note: "\u56FE\u8868 \xB7 \u6298\u7EBF" },
  { name: "donut_channel", note: "\u56FE\u8868 \xB7 \u73AF\u56FE" },
  { name: "kpi_row", note: "\u56FE\u8868 \xB7 \u6307\u6807\u5361" },
  { name: "\u770B\u677F\u4EA7\u7269 \xB7 \u6982\u89C8", note: "\u4EA7\u7269\u9875\u9762" }
];
var CHAIN = ["MySQL \u76F4\u8FDE\u53D6\u6570", "SQL \u805A\u5408\u51FA ds_orders", "\u56FE\u8868\u8282\u70B9\u6D88\u8D39 table \u8F93\u51FA"];
function DataSourceNodes() {
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("aside", { className: "flex w-60 shrink-0 flex-col border-r border-border bg-surface-raised", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u6570\u636E\u6E90" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto font-mono text-[10px] tabular-nums text-faint", children: "2" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "flex flex-col gap-0.5 px-2 py-2", children: CONNECTED.map((c) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
          "div",
          {
            className: `flex h-7 items-center gap-2 rounded-[4px] px-2 ${c.on ? "border border-accent bg-accent-soft" : "border border-transparent"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: c.icon, className: `size-3.5 shrink-0 ${c.on ? "text-accent" : "text-muted"}` }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: `text-[11px] ${c.on ? "text-accent" : "text-surface-foreground"}`, children: c.name }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto shrink-0 font-mono text-[9px] text-faint", children: c.note })
            ]
          },
          c.name
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-6 shrink-0 items-center gap-2 px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[10px] text-faint", children: "\u53EF\u7528\u6570\u636E\u96C6" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "4" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "flex flex-col gap-0.5 px-2", children: DATASETS.map((d) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-7 items-center gap-2 rounded-[4px] px-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--table-2]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "font-mono text-[11px] text-surface-foreground", children: d.name }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto shrink-0 text-[9px] text-faint", children: d.note })
        ] }, d.name)) }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "mt-auto flex flex-col gap-2 border-t border-border px-2 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
            "button",
            {
              type: "button",
              className: "flex h-7 items-center gap-2 rounded-control border border-border bg-surface px-2 text-[11px] text-surface-foreground",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--rotate-cw]", className: "size-3.5 shrink-0 text-muted" }),
                "\u4ECE\u63D2\u4EF6\u5DE5\u4F5C\u53F0\u540C\u6B65 schema"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: "px-1 text-[10px] leading-4 text-faint", children: "\u672C\u5730\u6587\u4EF6\u4E0E\u76F4\u8FDE\u6570\u636E\u6E90\u90FD\u53EA\u8BFB\u51FA\u5185\u5B58\uFF0C\u4E0D\u5199\u56DE ods_orders\u3002" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u6570\u636E\u6E90\u8282\u70B9" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Chip, { tone: "accent", children: "3 \u4E2A\u8282\u70B9 \xB7 0 \u8FDE\u63A5" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Chip, { icon: "icon-[lucide--square-check]", children: "\u5DF2\u8FDE\u63D2\u4EF6\u5DE5\u4F5C\u53F0" }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--minus]", title: "\u7F29\u5C0F" }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted", children: "100%" }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--plus]", title: "\u653E\u5927" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
          CanvasGround,
          {
            links: [
              { x1: 352, y1: 130, x2: 372, y2: 130, tone: "var(--color-series-1)" },
              { x1: 692, y1: 130, x2: 712, y2: 130, tone: "var(--color-series-1)", dashed: true }
            ],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
                NodeCard,
                {
                  title: "ods_orders \xB7 MySQL",
                  type: "\u6570\u636E\u6E90",
                  icon: "icon-[lucide--database]",
                  tone: TONE.table,
                  x: 32,
                  y: 64,
                  w: 320,
                  h: 196,
                  selected: true,
                  outputs: [{ row: 0, tone: TONE.table }],
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u8FDE\u63A5", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { mono: true, children: "prod-mysql:3306 / bi" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u8868", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeSelect, { children: "ods_orders" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u6A21\u5F0F", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeSeg, { options: ["\u76F4\u8FDE", "\u62BD\u53D6"], active: "\u76F4\u8FDE" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u5EF6\u8FDF", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { mono: true, children: "200 ms \xB7 12 486 \u884C" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u5F15\u7528", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { children: "\u753B\u5E03\u5185 4 \u5904" }) })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
                NodeCard,
                {
                  title: "ds_orders",
                  type: "SQL \u6570\u636E\u96C6",
                  icon: "icon-[lucide--scroll-text]",
                  tone: TONE.table,
                  x: 372,
                  y: 64,
                  w: 320,
                  h: 212,
                  inputs: [{ row: 0, tone: TONE.table }],
                  outputs: [{ row: 1, tone: TONE.table }],
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u6765\u6E90", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeSeg, { options: ["\u4E00\u952E\u5957\u7528", "\u624B\u5199"], active: "\u4E00\u952E\u5957\u7528" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "mt-1 rounded-[4px] border border-border bg-background px-1.5 py-1 font-mono text-[10px] leading-4 text-muted", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { children: "select channel, date, sum(gmv)" }),
                      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { children: "from ods_orders where date > now() - 14" }),
                      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { children: "group by 1, 2" })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u5B57\u6BB5", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { mono: true, children: "8 \u5217 \xB7 5 \u7EF4 3 \u5EA6\u91CF" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u5237\u65B0", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { children: "10 \u5206\u949F \xB7 \u7F13\u5B58\u547D\u4E2D" }) })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
                NodeCard,
                {
                  title: "2024Q3 \u6E20\u9053\u660E\u7EC6.csv",
                  type: "\u672C\u5730\u6587\u4EF6",
                  icon: "icon-[lucide--upload]",
                  tone: TONE.table,
                  x: 712,
                  y: 64,
                  w: 320,
                  h: 212,
                  outputs: [{ row: 0, tone: TONE.table }],
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u4E0A\u4F20", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { mono: true, children: "9.6 / 12.3 MB \xB7 78%" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "my-1 h-1 w-full overflow-hidden rounded-[2px] bg-neutral-muted", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "block h-full w-[78%] rounded-[2px] bg-accent" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u8868\u5934", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeValue, { mono: true, children: "8 \u5217 \xB7 \u5DF2\u8BC6\u522B 6 \u5217" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeRow, { label: "\u7528\u9014", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(NodeSeg, { options: ["\u4E34\u65F6", "\u8F6C\u6570\u636E\u96C6"], active: "\u4E34\u65F6" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "mt-1 flex h-8 items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-border text-[10px] text-faint", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--upload]", className: "size-3 shrink-0" }),
                      "\u62D6 CSV / Excel / Parquet \u5230\u8FD9\u91CC"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "absolute left-[32px] top-[300px] text-[10px] text-faint", children: "\u8F93\u51FA table \u2192 \u53EF\u8FDE\u4EFB\u610F\u56FE\u8868\u8282\u70B9" }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "absolute left-[372px] top-[300px] text-[10px] text-faint", children: "\u8F93\u51FA table \u2192 1 \u5BF9\u591A" }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "absolute left-[712px] top-[300px] text-[10px] text-faint", children: "\u8F93\u51FA table \u2192 \u5148\u8F6C\u6570\u636E\u96C6\u624D\u6301\u4E45" }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "absolute left-[32px] top-[344px] w-[1000px] overflow-hidden rounded-card border border-border bg-surface-raised", children: [
                /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-9 items-center gap-2 border-b border-border px-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--git-branch]", className: "size-3.5 shrink-0 text-muted" }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u8FD9\u53F0\u8282\u70B9\u7684\u53D6\u6570\u94FE\u8DEF" }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u53EA\u8BFB" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex items-center gap-2 px-3 py-3", children: [
                  CHAIN.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "flex items-center gap-2", children: [
                    i > 0 ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--arrow-right]", className: "size-3.5 shrink-0 text-faint" }) : null,
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "flex h-7 items-center gap-1.5 rounded-chip border border-border bg-surface px-2 text-[11px] text-surface-foreground", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-series-1" }),
                      c
                    ] })
                  ] }, c)),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "ml-auto flex h-7 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[11px] text-warning", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--circle-alert]", className: "size-3 shrink-0" }),
                    "\u672C\u5730\u6587\u4EF6\u4EC5\u672C\u6B21\u4F1A\u8BDD\u6709\u6548\uFF0C\u957F\u671F\u7528\u8BF7\u5148\u8F6C\u6210\u6570\u636E\u96C6"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "absolute left-[32px] top-[472px] w-[480px] overflow-hidden rounded-card border border-border bg-surface-raised", children: [
                /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-9 items-center gap-2 border-b border-border px-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--network]", className: "size-3.5 shrink-0 text-muted" }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u8C01\u5728\u7528\u8FD9\u4E2A\u6570\u636E\u6E90" }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "4" })
                ] }),
                CONSUMERS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "flex h-7 items-center gap-2 px-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--corner-down-left]", className: "size-3 shrink-0 text-faint" }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground", children: c.name }),
                  /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "shrink-0 text-[10px] text-faint", children: c.note })
                ] }, c.name)),
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "flex h-9 items-center gap-2 border-t border-border px-3", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[10px] text-faint", children: "\u9009\u4E2D\u6570\u636E\u6E90\u8282\u70B9\u65F6\uFF0C\u8FD9\u6761\u94FE\u8DEF\u4F1A\u663E\u793A\u5728\u53F3\u4FA7\u53C2\u6570\u9762\u677F\u7684\u300C\u8F93\u51FA\u300D\u91CC" }) })
              ] })
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("footer", { className: "flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface-raised px-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip bg-neutral-muted px-2 text-[10px] text-muted", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-muted" }),
        "3 \u4E2A\u6570\u636E\u6E90\u8282\u70B9 \xB7 0 \u4E2A\u5DF2\u8FD0\u884C"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "text-[11px] text-muted", children: "\u6570\u636E\u6E90\u8282\u70B9\u53EA\u58F0\u660E\u4ECE\u54EA\u53D6\u6570\uFF0C\u8FD0\u884C\u4E0E\u5426\u7531\u4E0B\u6E38\u56FE\u8868\u8282\u70B9\u51B3\u5B9A" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "ml-auto flex h-6 items-center gap-1.5 rounded-chip border border-border px-2 text-[10px] text-muted", children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Icon, { name: "icon-[lucide--lock]", className: "size-3 shrink-0" }),
        "\u53D6\u6570\u53EA\u5728\u5185\u5B58\u91CC"
      ] })
    ] })
  ] });
}

// frames/editor.tsx
var import_jsx_runtime24 = require("react/jsx-runtime");
function Editor() {
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(NodeLibrary, {}),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(CanvasStrip, {}),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(NodeGraph, {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(PropertyInspector, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(EditorStatusBar, {})
  ] });
}

// components/editor/AddNodeMenu.tsx
var import_jsx_runtime25 = require("react/jsx-runtime");
var GROUPS4 = [
  {
    label: "\u6570\u636E",
    items: [
      { icon: "icon-[lucide--database]", label: "\u6570\u636E\u6E90", hint: "MySQL" },
      { icon: "icon-[lucide--table-2]", label: "SQL \u6570\u636E\u96C6", hint: "\u4E00\u952E\u5957\u7528" },
      { icon: "icon-[lucide--scroll-text]", label: "\u624B\u5199 SQL" },
      { icon: "icon-[lucide--upload]", label: "\u672C\u5730\u6587\u4EF6", hint: "CSV" }
    ]
  },
  {
    label: "\u56FE\u8868",
    items: [
      { icon: "icon-[lucide--chart-line]", label: "\u6298\u7EBF\u56FE", hint: "6 \u53D8\u4F53", active: true },
      { icon: "icon-[lucide--chart-column]", label: "\u67F1\u72B6\u56FE", hint: "5 \u53D8\u4F53" },
      { icon: "icon-[lucide--chart-pie]", label: "\u997C\u56FE / \u73AF\u56FE" },
      { icon: "icon-[lucide--gauge]", label: "\u6307\u6807\u5361" }
    ]
  },
  {
    label: "\u5927\u5C4F",
    items: [
      { icon: "icon-[lucide--monitor]", label: "\u5927\u5C4F\u6807\u9898" },
      { icon: "icon-[lucide--activity]", label: "\u5927\u5C4F\u6307\u6807\u5361" },
      { icon: "icon-[lucide--list-ordered]", label: "\u5927\u5C4F\u6392\u884C\u699C" }
    ]
  },
  {
    label: "\u63A7\u4EF6\u4E0E\u4EA7\u7269",
    items: [
      { icon: "icon-[lucide--list-filter]", label: "\u7B5B\u9009\u5668" },
      { icon: "icon-[lucide--layout-dashboard]", label: "\u770B\u677F\u4EA7\u7269\u9875\u9762" },
      { icon: "icon-[lucide--share-2]", label: "\u53D1\u5E03\u4E0E\u5206\u4EAB" }
    ]
  }
];
var VARIANTS2 = ["\u57FA\u7840\u6298\u7EBF", "\u9762\u79EF", "\u5806\u53E0", "\u53CC\u8F74", "\u5E73\u6ED1", "\u9636\u68AF"];
function AddNodeMenu({ x, y }) {
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(import_jsx_runtime25.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(
      "div",
      {
        className: "absolute z-30 w-[248px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
        style: { left: x, top: y },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: "icon-[lucide--square-plus]", className: "size-3.5 shrink-0 text-accent" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u6DFB\u52A0\u8282\u70B9" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "ml-auto font-mono text-[10px] tabular-nums text-faint", children: "X 528 \xB7 Y 296" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "flex h-8 shrink-0 items-center gap-2 border-b border-border px-2.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: "icon-[lucide--search]", className: "size-3.5 shrink-0 text-faint" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "text-[11px] text-faint", children: "\u641C\u7D22\u8282\u70B9\u7C7B\u578B\u2026" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "ml-auto rounded-[3px] border border-border px-1 font-mono text-[9px] text-faint", children: "/" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { className: "py-1", children: GROUPS4.map((g) => /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "px-1 py-0.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { className: "px-2 py-1 text-[10px] text-faint", children: g.label }),
            g.items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(
              "div",
              {
                className: `flex h-7 items-center gap-2 rounded-[4px] px-2 ${it.active ? "bg-accent-soft text-accent" : "text-surface-foreground"}`,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: it.icon, className: "size-3.5 shrink-0" }),
                  /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px]", children: it.label }),
                  it.hint ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "shrink-0 font-mono text-[9px] text-faint", children: it.hint }) : null,
                  it.active ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: "icon-[lucide--chevron-right]", className: "size-3 shrink-0" }) : null
                ]
              },
              it.label
            ))
          ] }, g.label)) }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-background px-2.5 text-[10px] text-faint", children: [
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: "icon-[lucide--mouse-pointer-click]", className: "size-3 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { children: "\u753B\u5E03\u7A7A\u767D\u5904\u53CC\u51FB = \u76F4\u63A5\u63D2\u5165\u4E0A\u4E00\u6B21\u7684\u7C7B\u578B" })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(
      "div",
      {
        className: "absolute z-30 w-[176px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
        style: { left: x + 248, top: y + 152 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "flex h-8 items-center gap-2 border-b border-border bg-background px-2.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(Icon, { name: "icon-[lucide--chart-line]", className: "size-3.5 shrink-0 text-series-2" }),
            /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u6298\u7EBF\u56FE" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { className: "py-1", children: VARIANTS2.map((v) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: "flex h-6 items-center px-2.5 text-[11px] text-muted", children: v }, v)) }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { className: "flex h-7 items-center border-t border-border bg-background px-2.5 text-[10px] text-faint", children: "\u63D2\u5165\u540E\u53EF\u7528 AI \u6539\u53C2\u6570" })
        ]
      }
    )
  ] });
}

// frames/menu.tsx
var import_jsx_runtime26 = require("react/jsx-runtime");
function CanvasContextMenu() {
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(NodeLibrary, {}),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(CanvasStrip, {}),
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "relative flex min-h-0 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(NodeGraph, {}),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "absolute inset-0 z-20 bg-background/55" }),
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(AddNodeMenu, { x: 300, y: 236 })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(PropertyInspector, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(EditorStatusBar, {})
  ] });
}

// frames/nodes.tsx
var import_react = require("react");
var import_jsx_runtime27 = require("react/jsx-runtime");
var T = TONE.table;
var C = TONE.chart;
var R = TONE.result;
var BANDS = [
  {
    label: "\u6570\u636E",
    hint: "\u4ECE\u54EA\u6765 \u2014\u2014 \u8F93\u51FA table \u63D2\u5EA7",
    items: [
      {
        title: "ods_orders",
        type: "\u6570\u636E\u6E90",
        icon: "icon-[lucide--database]",
        tone: T,
        rows: [["\u8FDE\u63A5", "prod-mysql"], ["\u6A21\u5F0F", "\u76F4\u8FDE"]],
        note: "\u4ECE\u63D2\u4EF6\u5DE5\u4F5C\u53F0\u5DF2\u8FDE\u63A5\u7684\u6570\u636E\u6E90\u53D6\u8868\uFF0C\u4E0D\u843D\u5E93"
      },
      {
        title: "ds_orders",
        type: "\u6570\u636E\u96C6",
        icon: "icon-[lucide--scroll-text]",
        tone: T,
        rows: [["\u6765\u6E90", "\u4E00\u952E\u5957\u7528"], ["\u5B57\u6BB5", "8 \u5217"]],
        note: "\u4E00\u952E\u5957\u7528\u6216\u624B\u5199\uFF0C\u53EF\u88AB\u591A\u4E2A\u56FE\u8868\u8282\u70B9\u590D\u7528"
      },
      {
        title: "sql_gmv_14d",
        type: "\u624B\u5199 SQL",
        icon: "icon-[lucide--pencil]",
        tone: T,
        rows: [["\u5F15\u64CE", "duckdb"], ["\u7F13\u5B58", "10 \u5206\u949F"]],
        note: "\u4E0E\u5BBF\u4E3B AI \u5BF9\u8BDD\u628A SQL \u5199\u51FA\u6765\uFF0C\u518D\u5B58\u6210\u8BED\u6570\u636E\u96C6"
      },
      {
        title: "2024Q3.csv",
        type: "\u672C\u5730\u6587\u4EF6",
        icon: "icon-[lucide--upload]",
        tone: T,
        rows: [["\u884C\u6570", "12 486"], ["\u5217", "8 \u5217"]],
        note: "\u62D6\u8FDB\u6765\u76F4\u63A5\u5F53\u8868\u7528\uFF0C\u53EA\u5728\u672C\u6B21\u4F1A\u8BDD\u6709\u6548"
      }
    ]
  },
  {
    label: "\u56FE\u8868",
    hint: "\u753B\u4EC0\u4E48 \u2014\u2014 \u8F93\u51FA image\uFF0C\u53EF\u5355\u72EC\u8FD0\u884C\u51FA\u9884\u89C8",
    items: [
      {
        title: "line_gmv_14d",
        type: "\u6298\u7EBF\u56FE",
        icon: "icon-[lucide--chart-line]",
        tone: C,
        rows: [["X \u8F74", "date"], ["Y \u8F74", "gmv"]],
        note: "\u8D8B\u52BF\u5BF9\u6BD4 \xB7 6 \u79CD\u53D8\u4F53\uFF0C\u542B\u53BB\u5E74\u540C\u671F\u865A\u7EBF"
      },
      {
        title: "bar_city",
        type: "\u67F1\u72B6\u56FE",
        icon: "icon-[lucide--chart-column]",
        tone: C,
        rows: [["\u7EF4\u5EA6", "city"], ["\u6392\u5E8F", "\u964D\u5E8F"]],
        note: "\u5206\u7C7B\u6BD4\u8F83 \xB7 5 \u79CD\u53D8\u4F53\uFF0C\u6A2A\u7AD6\u53EF\u5207"
      },
      {
        title: "donut_channel",
        type: "\u997C\u73AF\u56FE",
        icon: "icon-[lucide--chart-pie]",
        tone: C,
        rows: [["\u7EF4\u5EA6", "channel"], ["\u5185\u73AF", "\u5F00"]],
        note: "\u5360\u6BD4\u6784\u6210 \xB7 \u73AF\u56FE\u4E0E\u6247\u5F62\u53EF\u5207"
      },
      {
        title: "kpi_row",
        type: "\u6307\u6807\u5361",
        icon: "icon-[lucide--gauge]",
        tone: C,
        rows: [["\u5EA6\u91CF", "gmv"], ["\u5BF9\u6BD4", "\u73AF\u6BD4"]],
        note: "\u5355\u503C + \u540C\u73AF\u6BD4\uFF0C\u770B\u677F\u9876\u90E8\u7684\u56DB\u5F20\u5361\u5C31\u662F\u5B83"
      },
      {
        title: "funnel_flow",
        type: "\u6F0F\u6597\u56FE",
        icon: "icon-[lucide--filter]",
        tone: C,
        rows: [["\u9636\u6BB5", "4 \u6BB5"], ["\u53E3\u5F84", "\u4EBA\u6570"]],
        note: "\u8F6C\u5316\u8870\u51CF \xB7 \u9636\u6BB5\u6309\u503C\u81EA\u52A8\u6536\u7A84"
      },
      {
        title: "box_price",
        type: "\u7BB1\u7EBF\u56FE",
        icon: "icon-[lucide--box]",
        tone: C,
        rows: [["\u5206\u7EC4", "\u6E20\u9053"], ["\u6307\u6807", "\u5BA2\u5355\u4EF7"]],
        note: "\u5206\u5E03\u4E0E\u79BB\u7FA4\u70B9 \xB7 \u4E94\u6570\u6982\u62EC"
      }
    ]
  },
  {
    label: "\u5927\u5C4F",
    hint: "1920 \xD7 1080 \u57FA\u51C6 \u2014\u2014 \u5B57\u53F7\u4E0E\u95F4\u8DDD\u6309 3 \u500D\u6295\u5C4F\u91CD\u65B0\u6392\u8FC7",
    items: [
      {
        title: "\u5927\u5C4F\u6807\u9898",
        type: "\u6807\u9898\u6761",
        icon: "icon-[lucide--monitor]",
        tone: C,
        rows: [["\u5B57\u53F7", "64 px"], ["\u88C5\u9970", "\u5206\u9694\u7EBF"]],
        note: "\u4E00\u6761\u5C45\u4E2D\u7684\u6807\u9898 + \u5DE6\u53F3\u88C5\u9970\u7EBF\uFF0C\u4E0D\u662F\u666E\u901A\u6587\u672C\u8282\u70B9"
      },
      {
        title: "\u5927\u5C4F\u6307\u6807\u5361",
        type: "\u5927\u5C4F\u6307\u6807",
        icon: "icon-[lucide--activity]",
        tone: C,
        rows: [["\u5B57\u53F7", "96 px"], ["\u52A8\u6548", "\u6570\u5B57\u6EDA\u52A8"]],
        note: "\u770B\u677F\u6307\u6807\u5361\u7684\u5927\u5C4F\u7248\uFF0C\u6570\u5B57\u53E3\u5F84\u4E00\u81F4\u3001\u53EA\u662F\u6392\u5217\u66F4\u5F00"
      },
      {
        title: "\u5927\u5C4F\u6392\u884C\u699C",
        type: "\u6392\u884C\u699C",
        icon: "icon-[lucide--list-ordered]",
        tone: C,
        rows: [["\u6761\u6570", "\u524D 10"], ["\u6EDA\u52A8", "8s \u4E00\u8F6E"]],
        note: "\u540D\u6B21\u5E26\u6761\u5F62\u5E95\uFF0C\u8D85\u8FC7\u4E00\u5C4F\u81EA\u52A8\u8F6E\u64AD"
      },
      {
        title: "\u5927\u5C4F\u8F6E\u64AD",
        type: "\u8F6E\u64AD\u5BB9\u5668",
        icon: "icon-[lucide--layout-dashboard]",
        tone: C,
        rows: [["\u9875\u6570", "3 \u9875"], ["\u95F4\u9694", "15s"]],
        note: "\u628A\u591A\u4E2A\u5927\u5C4F\u9875\u9762\u4E32\u6210\u4E00\u8F6E\uFF0C\u8282\u70B9\u91CC\u53EA\u653E\u7F16\u6392\u53C2\u6570"
      }
    ]
  },
  {
    label: "\u63A7\u4EF6\u4E0E\u4EA7\u7269",
    hint: "\u8C01\u6765\u6539 \u2014\u2014 \u8F93\u51FA control\uFF0C\u4E0D\u5F71\u54CD\u53D6\u6570",
    items: [
      {
        title: "filter_channel",
        type: "\u7B5B\u9009\u5668",
        icon: "icon-[lucide--list-filter]",
        tone: "var(--color-warning)",
        rows: [["\u5B57\u6BB5", "channel"], ["\u9ED8\u8BA4", "\u6296\u97F3"]],
        note: "\u8FDE\u5230\u56FE\u8868\u8282\u70B9\u5373\u751F\u6548\uFF0C\u6574\u9875\u5171\u7528\u4E00\u4E2A\u7B5B\u9009\u533A"
      },
      {
        title: "date_range",
        type: "\u65E5\u671F\u533A\u95F4",
        icon: "icon-[lucide--calendar-clock]",
        tone: "var(--color-warning)",
        rows: [["\u9ED8\u8BA4", "\u8FD1 14 \u5929"], ["\u5FEB\u6377", "4 \u9879"]],
        note: "\u5FEB\u6377\u533A\u95F4 + \u81EA\u5B9A\u4E49\u8D77\u6B62\uFF0C\u6539\u52A8\u4F1A\u91CD\u8DD1\u4E0B\u6E38"
      },
      {
        title: "\u770B\u677F\u4EA7\u7269 \xB7 \u6982\u89C8",
        type: "\u4EA7\u7269\u9875\u9762",
        icon: "icon-[lucide--grid-2x2]",
        tone: R,
        rows: [["\u7EC4\u4EF6", "6 \u4E2A"], ["\u5217\u6570", "12 \u5217"]],
        note: "\u628A\u4E0A\u6E38\u56FE\u8868\u6392\u6210\u4E00\u9875\uFF1B\u4EA7\u7269\u8282\u70B9\u4E0D\u81EA\u5DF1\u53D6\u6570"
      },
      {
        title: "\u53D1\u5E03\u4E0E\u5206\u4EAB",
        type: "\u53D1\u5E03",
        icon: "icon-[lucide--share-2]",
        tone: R,
        rows: [["\u76EE\u6807", "BI \u5DE5\u4F5C\u6811"], ["\u94FE\u63A5", "\u6C38\u4E45 / \u9650\u671F"]],
        note: "\u5B58\u8FDB\u5DE5\u4F5C\u6811\u5E76\u7ED9\u51FA\u53EF\u590D\u5236\u7684\u94FE\u63A5\uFF0C\u4E00\u6B21\u52A8\u4F5C"
      }
    ]
  }
];
function Specimen({ s }) {
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "flex w-[196px] shrink-0 flex-col gap-1.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: "relative h-[104px] w-[196px]", children: /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      NodeCard,
      {
        title: s.title,
        type: s.type,
        icon: s.icon,
        tone: s.tone,
        x: 0,
        y: 0,
        w: 196,
        h: 104,
        outputs: [{ row: 0, tone: s.tone }],
        children: s.rows.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(NodeRow, { label: k, children: /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(NodeValue, { mono: true, children: v }) }, k))
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "h-8 text-[10px] leading-4 text-faint", children: s.note })
  ] });
}
var LEGEND = [
  { tone: TONE.table, label: "table \xB7 \u6570\u636E" },
  { tone: TONE.chart, label: "image \xB7 \u56FE\u8868" },
  { tone: TONE.control, label: "control \xB7 \u63A7\u4EF6" },
  { tone: TONE.result, label: "product \xB7 \u4EA7\u7269" }
];
function NodeCatalog() {
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("header", { className: "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(Icon, { name: "icon-[lucide--boxes]", className: "size-4 shrink-0 text-accent" }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "text-[15px] font-semibold text-surface-foreground", children: "\u8282\u70B9\u603B\u89C8" }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(Chip, { tone: "accent", children: "18 \u79CD \xB7 \u770B\u677F 14 / \u5927\u5C4F 4" }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: "flex h-7 shrink-0 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5", children: ["\u5168\u90E8", "\u770B\u677F\u8282\u70B9", "\u5927\u5C4F\u8282\u70B9"].map((t) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
        "span",
        {
          className: `flex h-[22px] items-center rounded-[4px] px-2 text-[11px] ${t === "\u5168\u90E8" ? "bg-accent-soft font-medium text-accent" : "text-muted"}`,
          children: t
        },
        t
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "flex h-7 w-56 items-center gap-2 rounded-control border border-border bg-surface px-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(Icon, { name: "icon-[lucide--search]", className: "size-3.5 shrink-0 text-faint" }),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "text-[11px] text-faint", children: "\u641C\u7D22\u8282\u70B9\u7C7B\u578B\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "text-[11px] text-muted", children: "2 \u4E2A\u6570\u636E\u6E90\u5DF2\u8FDE\u63A5" }),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--minus]", title: "\u7F29\u5C0F" }),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "w-9 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted", children: "100%" }),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--plus]", title: "\u653E\u5927" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(CanvasGround, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: "absolute inset-0 overflow-hidden p-6", children: /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: "grid grid-cols-6 gap-x-4 gap-y-4", children: BANDS.map((b) => /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(import_react.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "col-span-6 flex items-center gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "text-[12px] font-semibold text-surface-foreground", children: b.label }),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "text-[10px] text-faint", children: b.hint }),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "h-px flex-1 bg-border" }),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "font-mono text-[10px] tabular-nums text-faint", children: b.items.length })
        ] }),
        b.items.map((s) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(Specimen, { s }, s.title))
      ] }, b.label)) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "absolute bottom-4 left-6 right-6 flex h-9 items-center gap-3 rounded-card border border-border bg-surface-raised px-3", children: [
        LEGEND.map((l) => /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("span", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "size-2 rounded-full", style: { background: l.tone } }),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "font-mono text-[10px] text-muted", children: l.label })
        ] }, l.label)),
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "ml-auto text-[10px] text-faint", children: "\u6BCF\u79CD\u8282\u70B9\u90FD\u80FD\u5355\u72EC\u8FD0\u884C \xB7 \u53F3\u952E\u753B\u5E03\u6DFB\u52A0 \xB7 \u4EA7\u7269\u7EDF\u4E00\u843D\u8FDB BI \u5DE5\u4F5C\u6811" })
      ] })
    ] })
  ] });
}

// components/editor/RunOverlay.tsx
var import_jsx_runtime28 = require("react/jsx-runtime");
var GMV3 = [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83];
var RUN = [
  { label: "ods_orders", icon: "icon-[lucide--database]", state: "done", t: "0.2s", note: "12 486 \u884C" },
  { label: "ds_orders", icon: "icon-[lucide--scroll-text]", state: "done", t: "0.4s", note: "\u7F13\u5B58\u547D\u4E2D" },
  { label: "line_gmv_14d", icon: "icon-[lucide--chart-line]", state: "running", t: "0.6s", note: "\u53D6\u6570\u4E2D" },
  { label: "donut_channel", icon: "icon-[lucide--chart-pie]", state: "wait", t: "\u2014", note: "\u7B49\u4E0A\u6E38" },
  { label: "kpi_row", icon: "icon-[lucide--gauge]", state: "wait", t: "\u2014", note: "\u7B49\u4E0A\u6E38" },
  { label: "\u770B\u677F\u4EA7\u7269 \xB7 \u6982\u89C8", icon: "icon-[lucide--layout-dashboard]", state: "wait", t: "\u2014", note: "\u7B49\u4E0A\u6E38" }
];
var STATE = {
  done: { icon: "icon-[lucide--circle-check]", cls: "text-success" },
  running: { icon: "icon-[lucide--loader]", cls: "text-accent animate-spin" },
  wait: { icon: "icon-[lucide--clock]", cls: "text-faint" }
};
function RunPanel({ x, y }) {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)(
    "div",
    {
      className: "absolute z-30 w-[296px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
      style: { left: x, top: y },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("header", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Icon, { name: "icon-[lucide--play]", className: "size-3.5 shrink-0 text-accent" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u672C\u6B21\u8FD0\u884C" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "ml-auto font-mono text-[10px] tabular-nums text-muted", children: "3 / 6 \xB7 1.2s" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { className: "px-2 py-1.5", children: RUN.map((r) => /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: "flex h-7 items-center gap-2 rounded-[4px] px-1.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Icon, { name: r.icon, className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "min-w-0 flex-1 truncate text-[11px] text-surface-foreground", children: r.label }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "shrink-0 text-[10px] text-faint", children: r.note }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted", children: r.t }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Icon, { name: STATE[r.state].icon, className: `size-3.5 shrink-0 ${STATE[r.state].cls}` })
        ] }, r.label)) }),
        /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("footer", { className: "flex h-11 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Btn, { size: "sm", variant: "ghost", children: "\u4EC5\u8FD0\u884C\u9009\u4E2D" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u2318R \u5168\u90E8" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--play]", children: "\u8FD0\u884C\u5168\u90E8" })
        ] })
      ]
    }
  );
}
function NodePreviewCard({ x, y }) {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)(
    "div",
    {
      className: "absolute z-30 w-[272px] overflow-hidden rounded-card border border-accent bg-surface-raised shadow-[0_18px_48px_var(--color-scrim)]",
      style: { left: x, top: y },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("header", { className: "flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Icon, { name: "icon-[lucide--chart-line]", className: "size-3.5 shrink-0 text-series-2" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u9884\u89C8 \xB7 line_gmv_14d" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "ml-auto shrink-0 font-mono text-[10px] text-faint", children: "1.2s" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: "px-2.5 py-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(AreaChart, { values: GMV3, domain: [0, 90], className: "h-[92px] w-full" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: "mt-1.5 flex items-center gap-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Chip, { tone: "accent", children: "14 \u4E2A\u70B9" }),
            /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Chip, { mono: true, children: "2026-10-11 22:40" }),
            /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: "ml-auto text-[10px] text-faint", children: "\u4E0D\u56DE\u5199\u6570\u636E\u5E93" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("footer", { className: "flex h-10 shrink-0 items-center gap-2 border-t border-border bg-background px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Btn, { size: "xs", variant: "ghost", icon: "icon-[lucide--copy]", children: "\u590D\u5236\u4E3A\u56FE\u7247" }),
          /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Btn, { size: "xs", variant: "ghost", className: "ml-auto", children: "\u5728\u4EA7\u7269\u91CC\u5B9A\u4F4D" })
        ] })
      ]
    }
  );
}

// frames/run.tsx
var import_jsx_runtime29 = require("react/jsx-runtime");
function RunCanvas() {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(NodeLibrary, {}),
      /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(CanvasStrip, {}),
        /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: "relative flex min-h-0 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(NodeGraph, {}),
          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(NodePreviewCard, { x: 296, y: 252 }),
          /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(RunPanel, { x: 560, y: 520 })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(PropertyInspector, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(EditorStatusBar, {})
  ] });
}

// components/editor/PublishDialog.tsx
var import_jsx_runtime30 = require("react/jsx-runtime");
var PAGES3 = ["\u6982\u89C8", "\u6E20\u9053\u660E\u7EC6", "\u57CE\u5E02\u5206\u5E03"];
function PublishDialog() {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: "absolute inset-0 z-40 flex items-center justify-center bg-scrim", children: /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "w-[560px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_24px_64px_var(--color-scrim)]", children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("header", { className: "flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Icon, { name: "icon-[lucide--upload]", className: "size-4 shrink-0 text-accent" }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "\u53D1\u5E03\u5230 BI \u5DE5\u4F5C\u6811" }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Chip, { tone: "accent", children: "\u6E20\u9053\u7ECF\u8425\u770B\u677F v4" }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "ml-auto shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--x]", title: "\u5173\u95ED" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "flex flex-col gap-3 px-4 py-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[11px] text-muted", children: "\u8FD9\u6B21\u6539\u4E86\u4EC0\u4E48" }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: "mt-1 flex h-8 items-center rounded-control border border-border bg-surface px-2.5 text-[12px] text-surface-foreground", children: "\u6298\u7EBF\u56FE\u6539\u4E3A\u6309\u5468\u805A\u5408\uFF0C\u8865\u53BB\u5E74\u540C\u671F\u865A\u7EBF" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: "flex flex-col gap-1.5", children: [
        { on: true, title: "\u5B58\u8FDB\u5DE5\u4F5C\u6811\uFF08\u8349\u7A3F\uFF09", desc: "\u968F\u65F6\u7EE7\u7EED\u6539\uFF0C\u4EA7\u7269\u9875\u9762\u4FDD\u6301\u4E0A\u4E00\u7248" },
        { on: false, title: "\u5B58\u8FDB\u5DE5\u4F5C\u6811\u5E76\u751F\u6210\u4EA7\u7269\u9875\u9762", desc: "\u6982\u89C8 \xB7 \u6E20\u9053\u660E\u7EC6 \xB7 \u57CE\u5E02\u5206\u5E03 \u4E00\u8D77\u66FF\u6362" }
      ].map((o) => /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("label", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(
          "span",
          {
            className: `grid size-3.5 shrink-0 place-items-center rounded-full border ${o.on ? "border-accent" : "border-border-strong"}`,
            children: o.on ? /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "size-1.5 rounded-full bg-accent" }) : null
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[12px] text-surface-foreground", children: o.title }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "ml-auto shrink-0 text-[11px] text-faint", children: o.desc })
      ] }, o.title)) }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[11px] text-muted", children: "\u4EA7\u7269\u9875\u9762" }),
        PAGES3.map((p) => /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Chip, { children: p }, p)),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "flex size-[18px] items-center justify-center rounded-chip bg-neutral-muted text-muted", children: /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Icon, { name: "icon-[lucide--plus]", className: "size-2.5" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "h-px w-full shrink-0 bg-border" }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Icon, { name: "icon-[lucide--link-2]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u6C38\u4E45\u94FE\u63A5" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "rounded-chip bg-neutral-muted px-1.5 text-[10px] text-muted", children: "\u53EA\u8BFB" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "ml-auto text-[10px] text-faint", children: "\u968F\u5DE5\u4F5C\u6811\u66F4\u65B0\uFF0C\u4E0D\u4F1A\u8FC7\u671F" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "min-w-0 flex-1 truncate font-mono text-[11px] text-accent", children: "bi.local/d/chan-ops-6f2a" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Btn, { size: "xs", variant: "ghost", icon: "icon-[lucide--copy]", children: "\u590D\u5236" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "flex h-6 items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Icon, { name: "icon-[lucide--calendar-clock]", className: "size-3.5 shrink-0 text-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u9650\u671F\u5206\u4EAB" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-muted", children: [
            /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "flex h-6 items-center rounded-control border border-border bg-surface px-2", children: "7 \u5929" }),
            /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-control border border-border bg-surface px-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Icon, { name: "icon-[lucide--lock]", className: "size-3 text-faint" }),
              "\u8BBF\u95EE\u5BC6\u7801\u5DF2\u5F00\u542F"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "flex h-6 items-center rounded-control border border-border bg-surface px-2", children: "\u53EA\u8BFB" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground", children: "bi.local/s/9k3p-7d" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Btn, { size: "xs", variant: "ghost", children: "\u91CD\u65B0\u751F\u6210" }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Btn, { size: "xs", icon: "icon-[lucide--copy]", children: "\u590D\u5236" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("footer", { className: "flex h-12 shrink-0 items-center gap-2 border-t border-border bg-background px-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("span", { className: "flex h-6 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[10px] text-warning", children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: "size-1.5 shrink-0 rounded-full bg-warning" }),
        "1 \u4E2A\u8282\u70B9\u672A\u8FD0\u884C"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Btn, { variant: "ghost", size: "sm", children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Btn, { variant: "primary", size: "sm", icon: "icon-[lucide--upload]", children: "\u53D1\u5E03\u5E76\u590D\u5236\u94FE\u63A5" })
      ] })
    ] })
  ] }) });
}

// frames/share.tsx
var import_jsx_runtime31 = require("react/jsx-runtime");
function PublishAndShare() {
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { className: "relative flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(EditorToolbar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(NodeLibrary, {}),
      /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col", children: [
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(CanvasStrip, {}),
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(NodeGraph, {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(PropertyInspector, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(EditorStatusBar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(PublishDialog, {})
  ] });
}

// frames/workbench.tsx
var import_jsx_runtime32 = require("react/jsx-runtime");
var NAV = [
  { icon: "icon-[lucide--layout-dashboard]", label: "\u6211\u7684\u770B\u677F", count: "6", on: true },
  { icon: "icon-[lucide--monitor]", label: "\u6570\u636E\u5927\u5C4F", count: "3", on: false },
  { icon: "icon-[lucide--table-2]", label: "\u6570\u636E\u96C6", count: "12", on: false },
  { icon: "icon-[lucide--folder-tree]", label: "\u5DE5\u4F5C\u6811", count: "2", on: false },
  { icon: "icon-[lucide--share-2]", label: "\u5206\u4EAB\u7ED9\u6211", count: "", on: false },
  { icon: "icon-[lucide--trash-2]", label: "\u56DE\u6536\u7AD9", count: "", on: false }
];
var BOARDS = [
  { name: "\u6E20\u9053\u7ECF\u8425\u770B\u677F", pages: "3 \u9875", nodes: "6 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E 22:24", state: "2 \u4E2A\u53D8\u66F4\u672A\u8FD0\u884C", kind: "area", on: true },
  { name: "\u57CE\u5E02\u5206\u5E03\u770B\u677F", pages: "2 \u9875", nodes: "5 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E \u6628\u5929", state: "\u5DF2\u53D1\u5E03", kind: "bars", on: false },
  { name: "\u6295\u653E\u6548\u679C\u770B\u677F", pages: "3 \u9875", nodes: "8 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E 10-09", state: "\u5DF2\u53D1\u5E03", kind: "donut", on: false },
  { name: "\u6E20\u9053\u7ECF\u8425\u5927\u5C4F", pages: "1 \u9875", nodes: "8 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E \u6628\u5929", state: "\u5DF2\u53D1\u5E03", kind: "area", on: false },
  { name: "\u5546\u54C1\u7ED3\u6784\u770B\u677F", pages: "2 \u9875", nodes: "4 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E 10-07", state: "\u5DF2\u53D1\u5E03", kind: "bars", on: false },
  { name: "\u5468\u4F1A\u9A7E\u9A76\u8231", pages: "4 \u9875", nodes: "9 \u8282\u70B9", meta: "\u66F4\u65B0\u4E8E 10-02", state: "\u8349\u7A3F", kind: "donut", on: false }
];
var RUNS = [
  { time: "22:24", name: "\u6E20\u9053\u7ECF\u8425\u770B\u677F", detail: "6 \u8282\u70B9 \xB7 3 \u4EA7\u7269\u9875\u9762", cost: "1.2s", state: "\u6210\u529F" },
  { time: "21:58", name: "\u6E20\u9053\u7ECF\u8425\u5927\u5C4F", detail: "8 \u8282\u70B9 \xB7 1 \u9875", cost: "2.4s", state: "\u6210\u529F" },
  { time: "18:40", name: "\u57CE\u5E02\u5206\u5E03\u770B\u677F", detail: "5 \u8282\u70B9 \xB7 2 \u4EA7\u7269\u9875\u9762", cost: "0.9s", state: "\u6210\u529F" },
  { time: "10-09", name: "\u6295\u653E\u6548\u679C\u770B\u677F", detail: "8 \u8282\u70B9 \xB7 3 \u4EA7\u7269\u9875\u9762", cost: "\u2014", state: "1 \u4E2A\u8282\u70B9\u5931\u8D25" }
];
var START = [
  { icon: "icon-[lucide--table-2]", title: "\u4ECE\u6570\u636E\u96C6\u65B0\u5EFA", note: "\u9009\u4E00\u5F20\u8868\uFF0C\u52FE\u5B57\u6BB5\uFF0C\u76F4\u63A5\u51FA\u56FE" },
  { icon: "icon-[lucide--wand-sparkles]", title: "\u8BA9 AI \u751F\u6210", note: "\u8BF4\u4E00\u53E5\u8981\u4EC0\u4E48\uFF0C\u5B83\u53BB\u62FC\u8282\u70B9" },
  { icon: "icon-[lucide--scroll-text]", title: "\u7C98\u4E00\u6761 SQL", note: "\u5DF2\u6709 SQL \u7684\u8BDD\uFF0C\u8D34\u8FDB\u6765\u5C31\u662F\u6570\u636E\u96C6" }
];
var PREVIEW2 = {
  area: [42, 48, 45, 55, 51, 61, 58, 66, 63, 72, 69, 78, 74, 83],
  bars: [36, 52, 44, 68, 58, 76, 63],
  donut: [38, 27, 19, 16]
};
function Preview({ kind }) {
  if (kind === "bars") return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Bars, { values: PREVIEW2.bars, className: "h-full", tone: "bg-series-2" });
  if (kind === "donut") {
    return /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-full items-center justify-center gap-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(
        Donut,
        {
          size: 72,
          thickness: 12,
          segments: PREVIEW2.donut.map((v, i) => ({ value: v, color: `var(--color-series-${i + 1})` }))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Bars, { values: PREVIEW2.donut, className: "h-12 w-16", tone: "bg-series-3" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(AreaChart, { values: PREVIEW2.area, className: "h-full w-full" });
}
function BiWorkbench() {
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground", children: [
    /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("header", { className: "flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-4 text-muted" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[13px] text-muted", children: "\u6570\u636E\u8D44\u4EA7" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--chevron-right]", className: "size-3.5 text-faint" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[13px] font-semibold text-surface-foreground", children: "BI \u5DE5\u4F5C\u53F0" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Chip, { tone: "accent", children: "\u672C\u5730\u5DE5\u4F5C\u6811" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-8 w-72 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--search]", className: "size-3.5 shrink-0 text-faint" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[12px] text-faint", children: "\u641C\u7D22\u770B\u677F\u3001\u5927\u5C4F\u3001\u6570\u636E\u96C6" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto shrink-0 font-mono text-[10px] text-faint", children: "\u2318K" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Btn, { size: "sm", variant: "ghost", icon: "icon-[lucide--table-2]", children: "\u6570\u636E\u96C6" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Btn, { size: "sm", variant: "ghost", icon: "icon-[lucide--folder-tree]", children: "\u5DE5\u4F5C\u6811" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "h-4 w-px shrink-0 bg-border" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(IconButton, { size: "sm", icon: "icon-[lucide--clock-3]", title: "\u6700\u8FD1\u6253\u5F00" }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("div", { className: "ml-1 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-[11px] text-muted", children: "\u8BF8" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex min-h-0 flex-1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("aside", { className: "flex w-52 shrink-0 flex-col border-r border-border bg-surface-raised px-2 py-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("div", { className: "flex flex-col gap-0.5", children: NAV.map((n) => /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)(
          "div",
          {
            className: `flex h-8 items-center gap-2 rounded-control px-2 ${n.on ? "bg-accent-soft" : ""}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: n.icon, className: `size-3.5 shrink-0 ${n.on ? "text-accent" : "text-muted"}` }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: `text-[12px] ${n.on ? "font-medium text-accent" : "text-surface-foreground"}`, children: n.label }),
              n.count ? /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: n.count }) : null
            ]
          },
          n.label
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "mt-auto flex flex-col gap-2 border-t border-border pt-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "px-2 text-[10px] text-faint", children: "\u6570\u636E\u6E90" }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-7 items-center gap-2 px-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--database]", className: "size-3.5 shrink-0 text-muted" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u751F\u4EA7\u5E93 MySQL" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto size-1.5 shrink-0 rounded-full bg-success" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-7 items-center gap-2 px-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--upload]", className: "size-3.5 shrink-0 text-muted" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u672C\u5730\u6587\u4EF6" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "3" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Btn, { size: "xs", variant: "ghost", icon: "icon-[lucide--settings]", className: "self-start", children: "\u7BA1\u7406\u6570\u636E\u6E90" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("main", { className: "flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-8 shrink-0 items-center gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[15px] font-semibold text-surface-foreground", children: "\u6211\u7684\u770B\u677F" }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Chip, { children: "6 \u4E2A" }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[11px] text-muted", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--clock-3]", className: "size-3.5 shrink-0" }),
              "\u6700\u8FD1\u66F4\u65B0",
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--chevron-down]", className: "size-3 text-faint" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-7 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "grid size-[22px] place-items-center rounded-[4px] bg-accent-soft text-accent", children: /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--grid-2x2]", className: "size-3.5" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "grid size-[22px] place-items-center rounded-[4px] text-muted", children: /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--list-ordered]", className: "size-3.5" }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--plus]", children: "\u65B0\u5EFA\u770B\u677F" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("div", { className: "grid shrink-0 grid-cols-3 gap-4", children: BOARDS.map((b) => /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)(
          "div",
          {
            className: `overflow-hidden rounded-card border bg-surface-raised ${b.on ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "relative h-[112px] border-b border-border bg-background px-3 py-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Preview, { kind: b.kind }),
                /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "absolute right-2 top-2 flex h-5 items-center gap-1 rounded-chip bg-surface-raised px-1.5 font-mono text-[10px] text-muted", children: b.nodes })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex flex-col gap-1.5 px-3 py-2.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "truncate text-[13px] font-medium text-surface-foreground", children: b.name }),
                  b.state === "2 \u4E2A\u53D8\u66F4\u672A\u8FD0\u884C" ? /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Chip, { tone: "warning", children: "\u672A\u8FD0\u884C" }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--x]", title: "\u66F4\u591A", className: "ml-auto" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2 text-[10px] text-faint", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { children: b.pages }),
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "h-3 w-px bg-border" }),
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { children: b.meta }),
                  /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto", children: b.state })
                ] })
              ] })
            ]
          },
          b.name
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-raised", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--play]", className: "size-3.5 shrink-0 text-muted" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u6700\u8FD1\u8FD0\u884C" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto text-[10px] text-faint", children: "\u770B\u677F\u4E0E\u5927\u5C4F\u5171\u7528\u540C\u4E00\u672C\u8D26" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 py-1.5", children: RUNS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex h-8 items-center gap-3 rounded-[4px] px-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "w-10 shrink-0 font-mono text-[10px] tabular-nums text-faint", children: r.time }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "w-40 shrink-0 truncate text-[11px] text-surface-foreground", children: r.name }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "min-w-0 flex-1 truncate text-[10px] text-faint", children: r.detail }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted", children: r.cost }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(
              "span",
              {
                className: `flex h-[18px] shrink-0 items-center rounded-chip px-1.5 text-[10px] ${r.state === "\u6210\u529F" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`,
                children: r.state
              }
            )
          ] }, r.time + r.name)) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("aside", { className: "flex w-72 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-surface-raised p-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u4ECE\u54EA\u5F00\u59CB" }),
          START.map((s) => /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: s.icon, className: "size-4 shrink-0 text-accent" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex min-w-0 flex-col", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[12px] text-surface-foreground", children: s.title }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "truncate text-[10px] text-faint", children: s.note })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--chevron-right]", className: "ml-auto size-3.5 shrink-0 text-faint" })
          ] }, s.title))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex flex-col gap-2 border-t border-border pt-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] font-medium text-surface-foreground", children: "\u4EA7\u7269\u94FE\u63A5" }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--link-2]", className: "size-3.5 shrink-0 text-muted" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u6C38\u4E45\u94FE\u63A5" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto font-mono text-[10px] text-faint", children: "\u4E0D\u8FC7\u671F" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "min-w-0 flex-1 truncate font-mono text-[10px] text-muted", children: "bi.local/d/chan-ops-6f2a" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--copy]", title: "\u590D\u5236\u6C38\u4E45\u94FE\u63A5" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex flex-col gap-1 rounded-card border border-border bg-surface px-2.5 py-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--calendar-clock]", className: "size-3.5 shrink-0 text-muted" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u9650\u671F\u5206\u4EAB" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "ml-auto font-mono text-[10px] text-warning", children: "\u5269 6 \u5929" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "min-w-0 flex-1 truncate font-mono text-[10px] text-muted", children: "bi.local/s/9k3p-7d" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--lock]", className: "size-3 shrink-0 text-faint" }),
              /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(IconButton, { size: "xs", icon: "icon-[lucide--copy]", title: "\u590D\u5236\u5206\u4EAB\u94FE\u63A5" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "mt-auto flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Icon, { name: "icon-[lucide--folder-tree]", className: "size-3.5 shrink-0 text-warning" }),
            /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("span", { className: "text-[11px] text-surface-foreground", children: "\u5DE5\u4F5C\u6811\u6709 2 \u4E2A\u53D8\u66F4\u5F85\u53D1\u5E03" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(Btn, { size: "sm", variant: "primary", icon: "icon-[lucide--upload]", children: "\u53D1\u5E03\u5E76\u590D\u5236\u94FE\u63A5" })
        ] })
      ] })
    ] })
  ] });
}

// .tmpcheck/probe.tsx
var frames = [
  ["agent", AgentConversation],
  ["ai-node", NodeParamsWithAi],
  ["back-button", BackButton],
  ["bigscreen", BigScreen],
  ["dashboard", Dashboard],
  ["data", DataSourceNodes],
  ["editor", Editor],
  ["menu", CanvasContextMenu],
  ["nodes", NodeCatalog],
  ["run", RunCanvas],
  ["share", PublishAndShare],
  ["workbench", BiWorkbench]
];
var bad = 0;
function probe(label, el) {
  try {
    const html = (0, import_server.renderToString)(el);
    console.log(`PASS  ${label.padEnd(30)} ${html.length} bytes`);
  } catch (err) {
    bad++;
    console.log(`FAIL  ${label}`);
    console.log(`      ${err.message.split("\n").slice(0, 8).join("\n      ")}`);
  }
}
console.log("=== shared components ===");
probe("<Btn>", (0, import_react2.createElement)(Btn, { children: "x" }));
probe("<Chip>", (0, import_react2.createElement)(Chip, { children: "x" }));
probe("<AreaChart>", (0, import_react2.createElement)(AreaChart, { values: [1, 2, 3] }));
probe("<Sparkline>", (0, import_react2.createElement)(Sparkline, { values: [1, 2, 3] }));
probe("<Bars>", (0, import_react2.createElement)(Bars, { values: [1, 2, 3] }));
probe("<HBars>", (0, import_react2.createElement)(HBars, { rows: [{ label: "a", value: 1, text: "1" }] }));
probe("<Donut>", (0, import_react2.createElement)(Donut, { segments: [{ value: 1, color: "red" }] }));
probe("<Funnel>", (0, import_react2.createElement)(Funnel, { stages: [{ label: "a", value: 1, text: "1" }] }));
probe("<Gauge>", (0, import_react2.createElement)(Gauge, { value: 1 }));
console.log("\n=== frames ===");
for (const [id, Comp] of frames) {
  if (typeof Comp !== "function") {
    console.log(`SKIP  ${id} (no default export)`);
    bad++;
    continue;
  }
  probe(`frames/${id}.tsx`, (0, import_react2.createElement)(Comp));
}
console.log(`
failed: ${bad} / ${frames.length + 9}`);
process.exit(bad === 0 ? 0 : 1);
