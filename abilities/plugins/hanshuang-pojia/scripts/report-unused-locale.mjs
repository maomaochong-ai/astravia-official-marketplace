// 找出 locales 里没有任何引用的键，并校验 zh/en 键集一致。
//
// 为什么不能用「前缀出现过就放行」：`t(`guide.stage.${stage}.title`)` 只覆盖
// guide.stage.*.title 这一族，不覆盖 `guide.stage.*.where`。旧版按前缀放行整族，
// 于是 38 个真死键一直被报成 0 —— 门禁通过得毫无意义。
//
// 这里的判据是**模板形状**：只有当键能展开成某个真实的 `前缀.${变量}.后缀` 时才算被用。
//
//   node scripts/report-unused-locale.mjs zh.json            列出未使用键
//   node scripts/report-unused-locale.mjs zh.json --strict   有未使用键或键集不一致就非零退出
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] ?? "zh.json";
const strict = process.argv.includes("--strict");

const locale = JSON.parse(readFileSync(join(root, "locales", file), "utf8"));
const sources = [];
const walk = dir => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (/\.tsx?$/.test(entry.name)) sources.push(readFileSync(full, "utf8"));
	}
};
walk(join(root, "src"));
// 工具标签与技能名在 manifest 里以 %key% 的形式引用，不算未使用。
for (const manifest of ["plugin.json", "ability.json"]) {
	try {
		sources.push(readFileSync(join(root, manifest), "utf8"));
	} catch {
		/* 文件不存在就跳过 */
	}
}
const blob = sources.join("\n");

/** 收集源码里所有 `前缀.${变量}` / `前缀.${变量}.后缀` 形状。 */
const shapes = [];
for (const match of blob.matchAll(/([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\.\$\{([^}]+)\}(?:\.([A-Za-z0-9_]+))?/g)) {
	shapes.push({ prefix: match[1], suffix: match[3] ?? null });
}

const covered = key => {
	for (const shape of shapes) {
		if (!key.startsWith(`${shape.prefix}.`)) continue;
		const rest = key.slice(shape.prefix.length + 1);
		// 无后缀形状（`panel.${kind}`）里的变量本身可能就是多段，所以不限制 rest 的段数。
		if (shape.suffix === null) return true;
		// 变量本身可能含点（`guide.${step}.title` 里 step = "step.pick"），所以只要求
		// 「最后一段正好是后缀、前面至少还有一段」，中间几段不追究。
		if (rest.endsWith(`.${shape.suffix}`) && rest.length > shape.suffix.length + 1) return true;
	}
	return false;
};

const literal = key => blob.includes(`"${key}"`) || blob.includes(`'${key}'`) || blob.includes(`%${key}%`);

const unused = Object.keys(locale).filter(key => !literal(key) && !covered(key));

const other = file === "zh.json" ? "en.json" : "zh.json";
let parity = [];
try {
	const peer = JSON.parse(readFileSync(join(root, "locales", other), "utf8"));
	const missing = Object.keys(locale).filter(key => !(key in peer));
	const extra = Object.keys(peer).filter(key => !(key in locale));
	parity = [...missing.map(k => `${k}  只存在于 ${file}`), ...extra.map(k => `${k}  只存在于 ${other}`)];
} catch {
	parity = [`无法读取 locales/${other}`];
}

console.log(`# ${file} — ${unused.length} unused key(s) of ${Object.keys(locale).length}, ${parity.length} key-set difference(s)`);
for (const key of unused) console.log(`unused  ${key}`);
for (const line of parity) console.log(`parity  ${line}`);

if (strict && (unused.length > 0 || parity.length > 0)) {
	console.error("\nFAIL: locales contain keys nothing references, or zh/en key sets disagree.");
	console.error("Either wire the key up, delete it, or update the template in the component to match.");
	process.exit(1);
}
