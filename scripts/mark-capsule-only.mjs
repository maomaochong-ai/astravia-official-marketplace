/**
 * 把 21 个插件的输入动作标成 capsule-only。
 *
 * `placement` 是宿主侧新增字段（见 scripts/capsule-only.mjs），当前宿主的白名单拷贝会
 * 丢掉它，所以现在加上是**行为零变化的前置声明**；宿主带上那个字段后，这批插件立刻变成
 * 「斜杠面板工具行不出现、只在输入框内以胶囊显示」。
 *
 * 旧类型里没有这个属性，所以用对象展开绕过多余属性检查——运行时只是一个普通键。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "D:/open-source-projects/astravia-official-marketplace/abilities/plugins";
const PLUGINS = [
	"designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
	"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
	"craft-anything", "boardmix", "rea", "strix", "video-downloader", "web-element-picker", "dbx-pro",
];

const MARKER = "placement: \"capsule\"";
const changed = [];

for (const plugin of PLUGINS) {
	const candidates = [
		join(ROOT, plugin, "src/index.tsx"),
		join(ROOT, plugin, "src/hooks/input-action.ts"),
	];
	for (const file of candidates) {
		if (!existsSync(file)) continue;
		const before = readFileSync(file, "utf8");
		if (!before.includes("registerInputAction({")) continue;
		if (before.includes(MARKER)) continue;
		const after = before.replace(
			"registerInputAction({",
			// 展开一个普通对象：绕开旧类型的多余属性检查，宿主侧读的是真键。
			`registerInputAction({ ...({ placement: "capsule" } as Record<string, unknown>),`,
		);
		writeFileSync(file, after, "utf8");
		changed.push(file.replace(`${ROOT}/`, ""));
		break;
	}
}

console.log(changed.length ? changed.map((file) => `patched ${file}`).join("\n") : "nothing patched");
