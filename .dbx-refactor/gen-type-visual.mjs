// 从旧项目 database-type-catalog.ts 抽取类型视觉表，生成插件侧 src/domain/database-type-visual.ts
// 只读旧项目源码；输出只写插件目录内文件。
import { readFileSync, writeFileSync } from "node:fs";

const OLD = "/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia/packages/desktop-app/src/renderer/domains/database/lib/database-type-catalog.ts";
const NEW = "/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/domain/database-type-visual.ts";
const MANIFEST = "/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/domain/connection-config.ts";

const src = readFileSync(OLD, "utf8");

// 逐条匹配 { value: "x", label: "X", badge: "xx", color: "#hex", group: "g", ... }
const entryRe = /\{\s*value:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*badge:\s*"([^"]*)",\s*color:\s*"([^"]*)",\s*group:\s*"([^"]*)"/g;
const rows = [];
for (const m of src.matchAll(entryRe)) {
	rows.push({ value: m[1], label: m[2], badge: m[3], color: m[4], group: m[5] });
}

// 分组顺序表
const groupRe = /\{\s*id:\s*"([^"]+)",\s*labelKey:\s*"([^"]*)"\s*\}/g;
const groups = [];
for (const m of src.matchAll(groupRe)) groups.push({ id: m[1], labelKey: m[2] });

// 插件侧 dbType 清单
const manifestSrc = readFileSync(MANIFEST, "utf8");
const pluginTypes = [...manifestSrc.matchAll(/dbType:\s*"([^"]+)"/g)].map((m) => m[1]);

const byValue = new Map(rows.map((r) => [r.value, r]));
const missing = pluginTypes.filter((t) => !byValue.has(t));
const matched = pluginTypes.length - missing.length;

console.log(`旧项目条目: ${rows.length} / 分组: ${groups.length}`);
console.log(`插件类型: ${pluginTypes.length} · 命中配色: ${matched} · 缺失: ${missing.length}`);
if (missing.length) console.log("缺失:", missing.join(", "));
if (!rows.length) { console.error("抽取失败：0 条"); process.exit(1); }

const GROUP_LABELS = {
	relational: { en: "Relational & OLAP", zh: "关系型 / OLAP" },
	nosql: { en: "NoSQL", zh: "NoSQL" },
	cloud: { en: "Cloud", zh: "云服务" },
	search: { en: "Search", zh: "搜索" },
	timeseries: { en: "Time Series", zh: "时序" },
	kv: { en: "Key-Value", zh: "键值" },
	other: { en: "Other", zh: "其他" },
};

const lines = [];
lines.push("/**");
lines.push(" * 数据库类型的视觉标识 — 品牌色与缩写。");
lines.push(" *");
lines.push(" * 数据来源：旧项目 database-type-catalog.ts 的 badge / color / group 字段，逐条移植，");
lines.push(" * 保证工作台里连接列表、对象树、类型选择器的类型标识与旧设计一致。");
lines.push(" * 未收录的类型按分组回退（fallback），不会出现无标识的条目。");
lines.push(" */");
lines.push("");
lines.push("export interface DatabaseTypeVisual {");
lines.push("\t/** 2 字符缩写，用于方形类型徽标 */");
lines.push("\treadonly badge: string;");
lines.push("\t/** 品牌色（#rrggbb） */");
lines.push("\treadonly color: string;");
lines.push("\t/** 分组标识，用于选择器分组与回退配色 */");
lines.push("\treadonly group: DatabaseTypeGroup;");
lines.push("}");
lines.push("");
lines.push("export type DatabaseTypeGroup =");
lines.push(groups.map((g) => `\t| "${g.id}"`).join("\n") + ";");
lines.push("");
lines.push("export const DATABASE_TYPE_GROUP_LABELS: Record<DatabaseTypeGroup, { en: string; zh: string }> = {");
for (const g of groups) {
	lines.push(`\t${g.id}: ${JSON.stringify(GROUP_LABELS[g.id] ?? { en: g.id, zh: g.id })},`);
}
lines.push("};");
lines.push("");
lines.push("/** 分组顺序（选择器中的分组展示顺序）。 */");
lines.push("export const DATABASE_TYPE_GROUP_ORDER: DatabaseTypeGroup[] = [");
lines.push(groups.map((g) => `\t"${g.id}"`).join(",\n") + ",");
lines.push("];");
lines.push("");
lines.push("/** 逐条移植自旧项目的类型视觉表。 */");
lines.push("export const DATABASE_TYPE_VISUALS: Record<string, DatabaseTypeVisual> = {");
for (const r of rows) {
	lines.push(`\t${JSON.stringify(r.value)}: { badge: ${JSON.stringify(r.badge)}, color: ${JSON.stringify(r.color)}, group: ${JSON.stringify(r.group)} },`);
}
lines.push("};");
lines.push("");
lines.push("const FALLBACK_COLOR = \"#64748b\";");
lines.push("");
lines.push("function initialsFrom(dbType: string): string {");
lines.push("\tconst parts = dbType.split(/[-_.]/).filter(Boolean);");
lines.push("\tif (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();");
lines.push("\treturn dbType.slice(0, 2).toUpperCase();");
lines.push("}");
lines.push("");
lines.push("/** 取类型的视觉标识；未收录类型按名称缩写 + 中性灰回退。 */");
lines.push("export function getDatabaseTypeVisual(dbType: string): DatabaseTypeVisual {");
lines.push("\tconst known = DATABASE_TYPE_VISUALS[dbType];");
lines.push("\tif (known) return known;");
lines.push("\treturn { badge: initialsFrom(dbType), color: FALLBACK_COLOR, group: \"other\" };");
lines.push("}");
lines.push("");

writeFileSync(NEW, lines.join("\n"), "utf8");
console.log(`已写入 ${NEW}`);
