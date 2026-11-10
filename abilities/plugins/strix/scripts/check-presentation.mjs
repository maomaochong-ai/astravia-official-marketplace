/**
 * Validate this plugin's capability-page presentation with the host's own
 * schemas, not a re-implementation of them.
 *
 * The 能力 page renders `ability.json` + `detail.json` through
 * apps/desktop/src/main/abilities/open-marketplace/open-marketplace-presentation.ts.
 * A shape the host refuses degrades to the README fallback (or blanks the entry
 * outright when no fallback is declared), which is exactly the "插件在能力页显示
 * 异常" symptom. Running the real zod schemas here catches it before release.
 *
 * Node cannot import TypeScript directly, so the schema module is transpiled by
 * tsx from the tooling checkout named by .astravia/publish.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "../../..");
const TOOLING = join(REPO, ".tooling/open-astravia");
const SCHEMA = join(TOOLING, "apps/desktop/src/main/abilities/open-marketplace/marketplace-schema.ts");
// npm on Windows installs `tsx.exe`; POSIX uses the bare name.
const TSX = join(TOOLING, "node_modules/.bin", process.platform === "win32" ? "tsx.exe" : "tsx");

function fail(message) {
	console.error(`✗ ${message}`);
	process.exitCode = 1;
}

if (!existsSync(TSX)) {
	console.error(`skip: ${TSX} is missing; run the repository build first`);
	process.exit(0);
}
if (!existsSync(SCHEMA)) {
	console.error(`skip: ${SCHEMA} is missing at the pinned tooling commit`);
	process.exit(0);
}

const probe = `
import { existsSync, readFileSync } from "node:fs";
import {
  marketplaceDetailBlockSchema,
  marketplaceMetaEntrySchema,
} from ${JSON.stringify(SCHEMA)};

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const root = ${JSON.stringify(ROOT)};
const blockDoc = (p) => {
  const doc = read(p);
  const out = [];
  for (const [index, block] of doc.blocks.entries()) {
    const parsed = marketplaceDetailBlockSchema.safeParse(block);
    if (!parsed.success) {
      out.push({ file: p, index, type: block?.type, issues: parsed.error.issues.map((i) => i.message + " @ " + i.path.join(".")) });
    }
  }
  return { schemaVersion: doc.schemaVersion, blocks: doc.blocks.length, invalid: out };
};

const result = {
  ability: {},
  details: [],
};
const ability = read(root + "/ability.json");
ability.detail?.meta?.forEach((entry, index) => {
  const parsed = marketplaceMetaEntrySchema.safeParse(entry);
  if (!parsed.success) result.ability["detail.meta[" + index + "]"] = parsed.error.issues.map((i) => i.message);
});
result.hasIcon = existsSync(root + "/" + (ability.icon ?? ""));
result.iconPath = ability.icon;
const en = blockDoc(root + "/detail.json");
const zh = blockDoc(root + "/detail.zh.json");
result.details.push({ locale: "en", ...en }, { locale: "zh", ...zh });
result.required = {
  hero: en.invalid.length === 0 && read(root + "/detail.json").blocks.some((b) => b.type === "hero"),
  showcase: read(root + "/detail.json").blocks.some((b) => b.type === "showcase"),
  steps: (() => { const s = read(root + "/detail.json").blocks.find((b) => b.type === "steps"); return Boolean(s) && s.items.length > 0 && s.items.length <= 3; })(),
};
console.log(JSON.stringify(result, null, 1));
`;

const output = execFileSync(TSX, ["-e", probe], {
	cwd: TOOLING,
	encoding: "utf8",
	maxBuffer: 8 * 1024 * 1024,
	env: { ...process.env, NODE_NO_WARNINGS: "1" },
});
const result = JSON.parse(output);

const invalid = result.details.flatMap((doc) => doc.invalid.map((item) => ({ ...item, locale: doc.locale })));
for (const item of invalid) {
	fail(`${item.locale} detail block #${item.index} (${item.type ?? "unknown"}): ${item.issues.join("; ")}`);
}
for (const [path, issues] of Object.entries(result.ability)) {
	fail(`ability.json ${path}: ${issues.join("; ")}`);
}
if (!result.hasIcon) fail(`icon file is missing: ${result.iconPath}`);
for (const [name, ok] of Object.entries(result.required)) {
	if (!ok) fail(`detail.json is missing a valid "${name}" block`);
}

if (!process.exitCode) {
	const counts = result.details.map((doc) => `${doc.locale}=${doc.blocks}`).join(" ");
	console.log(`✓ capability page presentation is valid (${counts} blocks, icon ${result.iconPath})`);
}
