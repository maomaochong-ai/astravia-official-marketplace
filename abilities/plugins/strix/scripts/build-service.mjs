/**
 * Bundle the host-node service from `src/service/` into `dist/service/main.mjs`.
 *
 * The host launches the entry with plain Node, and the packager copies `dist/` as
 * it finds it - so the artifact has to be JavaScript even though every line is
 * authored in TypeScript. This step is the only bridge between the two, and there
 * is deliberately no `service/` directory in the source tree: generated code lives
 * next to the rest of the build output, which is already gitignored.
 *
 * Runs *after* `vite build`, because Vite empties `dist/` on each run.
 */

import { build } from "esbuild";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist", "service");
const outFile = join(outDir, "main.mjs");

await mkdir(outDir, { recursive: true });

await build({
	entryPoints: [join(root, "src/service/main.ts")],
	outfile: outFile,
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	banner: { js: "// Generated from src/service/*.ts by scripts/build-service.mjs - do not edit." },
	logLevel: "warning",
});

/** The shipped service must stay one language; refuse to bundle any Python. */
async function assertJavaScriptOnly(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			await assertJavaScriptOnly(full);
			continue;
		}
		if (entry.name.endsWith(".py")) throw new Error(`Python source in the shipped service: ${full}`);
	}
}
await assertJavaScriptOnly(outDir);

const bundle = await readFile(outFile, "utf8");
if (!bundle.includes("tools/list")) throw new Error("bundle looks wrong: no MCP tool surface found");
console.log(`dist/service/main.mjs built (${(bundle.length / 1024).toFixed(1)} kB)`);
