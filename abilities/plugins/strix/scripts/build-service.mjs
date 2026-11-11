/**
 * Bundle the host-node service from `src/service/` into `service/main.mjs`.
 *
 * The host launches the entry with plain Node, and the marketplace packager copies
 * `service/` as it is - so the shipped artifact has to be JavaScript even though
 * every line is authored in TypeScript. This step is the bridge between the two,
 * and `npm run build` runs it before the UI build.
 */

import { build } from "esbuild";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "service");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
	entryPoints: [join(root, "src/service/main.ts")],
	outfile: join(outDir, "main.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	banner: { js: "// Generated from src/service/*.ts by scripts/build-service.mjs - do not edit." },
	logLevel: "warning",
});

/** The service must stay one language: refuse to ship any Python. */
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

const bundle = await readFile(join(outDir, "main.mjs"), "utf8");
console.log(`service/main.mjs built (${(bundle.length / 1024).toFixed(1)} kB)`);
