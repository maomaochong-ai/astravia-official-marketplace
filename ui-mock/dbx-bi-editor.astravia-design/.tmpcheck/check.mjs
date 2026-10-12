// Source-level audit: theme tokens, inline token vars, iconify names, relative imports.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const theme = readFileSync(join(ROOT, "theme.css"), "utf8");
const tokens = new Set(
  [...theme.matchAll(/--((?:color|radius|font|text|leading|tracking|shadow)-[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
);

const VALUE = new Set([
  // directions / sides / styles
  "t", "b", "l", "r", "x", "y", "s", "e", "start", "end", "dashed", "dotted", "solid", "double", "none",
  "hidden", "visible", "auto", "full", "inherit", "current", "transparent", "white", "black", "initial",
  "left", "right", "center", "justify", "nowrap", "wrap", "clip", "ellipsis", "balance", "pretty",
  "collapse", "separate", "baseline", "top", "middle", "bottom", "stretch", "reverse", "normal", "no-underline",
  "overline", "line-through", "underline", "list", "auto-cols", "auto-rows", "cover", "contain",
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p, out);
    } else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, "frames")), ...walk(join(ROOT, "components"))];

const UTIL = /^(?:[a-z-]+:)*(bg|text|border|ring|divide|from|to|via|fill|stroke|outline|shadow|placeholder|caret|decoration|accent)-(.+)$/;
const badUtils = new Map();
const badIcons = new Map();
const badImports = new Map();
const badVars = new Map();
let iconCount = 0;
let utilCount = 0;

// 引擎目录会随版本号变化，且没装依赖时不存在；逐一尝试可用来源。
const iconifyRoots = [
  "/Users/zhugeyue/.astravia/plugin-data/astravia-ui-design/design-engine/0.4.0/node_modules/@iconify-json",
  resolve(import.meta.dirname, "../../../abilities/plugins/dbx-pro/node_modules/@iconify-json"),
].filter((root) => existsSync(root));
const iconSets = {};
for (const root of iconifyRoots) {
  for (const set of readdirSync(root)) {
    const f = join(root, set, "icons.json");
    if (!existsSync(f) || iconSets[set]) continue;
    try {
      iconSets[set] = new Set(Object.keys(JSON.parse(readFileSync(f, "utf8")).icons ?? {}));
    } catch {
      iconSets[set] = new Set();
    }
  }
}
console.log(`icon sets from: ${iconifyRoots.join(", ") || "(none found)"}`);

function okUtility(suffix) {
  const name = suffix.replace(/\/[0-9.]+$/, "");
  if (/^\[.*\]$/.test(name)) return true;
  if (/^[0-9]+(?:\.[0-9]+)?(?:\/[0-9]+)?$/.test(name)) return true;
  for (const pre of ["color", "radius", "font", "text", "leading", "tracking", "shadow"]) {
    if (tokens.has(`${pre}-${name}`)) return true;
  }
  if (VALUE.has(name)) return true;
  if (name.startsWith("(") || name.includes("[")) return true;
  return false;
}

for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  const src = readFileSync(file, "utf8");

  for (const m of src.matchAll(/(?:className|class)="([^"]+)"/g)) {
    for (const cls of m[1].split(/\s+/)) {
      if (!cls) continue;
      const hit = UTIL.exec(cls);
      if (!hit) continue;
      utilCount++;
      if (!okUtility(hit[2])) {
        if (!badUtils.has(cls)) badUtils.set(cls, new Set());
        badUtils.get(cls).add(rel);
      }
    }
  }

  for (const m of src.matchAll(/icon-\[([a-z0-9-]+)--([a-z0-9-]+)\]/g)) {
    iconCount++;
    const [, set, name] = m;
    if (!iconSets[set]?.has(name)) {
      if (!badIcons.has(m[0])) badIcons.set(m[0], new Set());
      badIcons.get(m[0]).add(rel);
    }
  }

  for (const m of src.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
    if (!tokens.has(m[1])) {
      if (!badVars.has(m[1])) badVars.set(m[1], new Set());
      badVars.get(m[1]).add(rel);
    }
  }

  for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
    const base = resolve(dirname(file), m[1]);
    const ok = [".tsx", ".ts", "/index.tsx", "/index.ts", ""].some((ext) => existsSync(base + ext));
    if (!ok) {
      if (!badImports.has(m[1])) badImports.set(m[1], new Set());
      badImports.get(m[1]).add(rel);
    }
  }
}

const show = (label, map) => {
  console.log(`\n=== ${label} ===`);
  if (map.size === 0) return console.log("(none)");
  for (const [k, v] of map) console.log(`  ${k}  <- ${[...v].join(", ")}`);
};

console.log(`files scanned: ${files.length} | utility classes checked: ${utilCount} | icons checked: ${iconCount}`);
console.log(`theme tokens: ${tokens.size}`);
show("unresolved color/radius/font/shadow utilities", badUtils);
show("icons missing from local @iconify-json", badIcons);
show("unresolved var(--token)", badVars);
show("unresolved relative imports", badImports);
