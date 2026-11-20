// 一次性审查辅助：找出 locales 里没有任何静态引用、也没有被模板前缀动态拼过的键。
// 只读，不改任何文件；输出给 code-review 用。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const locale = JSON.parse(readFileSync(join(root, "locales", process.argv[2] ?? "zh.json"), "utf8"));
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

const used = new Set();
for (const key of Object.keys(locale)) {
	if (blob.includes(`"${key}"`) || blob.includes(`'${key}'`) || blob.includes(`%${key}%`)) {
		used.add(key);
		continue;
	}
	// 动态前缀：t(`page.stage.${stage}.title`) 这种，按前缀匹配到最长的静态段。
	const parts = key.split(".");
	for (let cut = parts.length - 1; cut >= 1; cut -= 1) {
		if (blob.includes(`${parts.slice(0, cut).join(".")}.\${`)) {
			used.add(key);
			break;
		}
	}
}

const unused = Object.keys(locale).filter(key => !used.has(key));
console.log(`# ${process.argv[2] ?? "zh.json"} — ${unused.length} unused key(s) of ${Object.keys(locale).length}`);
for (const key of unused) console.log(key);
