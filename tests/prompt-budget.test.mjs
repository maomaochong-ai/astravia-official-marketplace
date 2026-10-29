import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const pluginsDir = resolve(root, "abilities/plugins");

// `agent.systemPrompt.promptPaths` blocks are appended to the system prompt of EVERY session, for
// every project, whether or not the plugin is being used. That cost is paid on every turn of the
// conversation, so an oversized block pushes ordinary tasks into `context compaction` on the first
// or second turn — and the compaction card streams a 20k-72k character markdown summary back into
// the transcript.
//
// hanshuang-pojia shipped a 98 KB block here until 2.4.0 and dropped the channel entirely; every
// other plugin is well under the cap. This test is the guard that keeps the always-on channel from
// quietly coming back over budget: long-form material belongs in a skill, which is loaded on demand.
// See the hanshuang-pojia README section "Where the rules live".
const PROMPT_BUDGET_BYTES = 12 * 1024;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function pluginDirectories() {
	return readdirSync(pluginsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(pluginsDir, entry.name))
		.filter((directory) => {
			try {
				statSync(join(directory, "plugin.json"));
				return true;
			} catch {
				return false;
			}
		});
}

test("plugins keep the always-on system prompt block inside the prompt budget", () => {
	const offenders = [];
	for (const directory of pluginDirectories()) {
		const plugin = readJson(join(directory, "plugin.json"));
		const paths = plugin.agent?.systemPrompt?.promptPaths ?? [];
		if (paths.length === 0) continue;
		let total = 0;
		for (const path of paths) {
			// 一个条目只能是一个文件：写成目录会把下面所有内容悄悄注入常驻提示词。
			// 不按「有没有斜杠」判定——`agent/prompts/x.md` 同样是单文件，宿主按插件根解析，
			// 打包器也会把它当 manifest 资源收进包里。
			const promptPath = join(directory, path);
			assert.equal(statSync(promptPath).isFile(), true, `${plugin.id}: promptPaths must name a file (${path})`);
			const bytes = statSync(promptPath).size;
			assert.ok(bytes > 0, `${plugin.id}: injected prompt ${path} is empty`);
			total += bytes;
		}
		if (total > PROMPT_BUDGET_BYTES) {
			offenders.push(`${plugin.id}: ${total} bytes across ${paths.join(", ")}`);
		}
	}
	assert.deepEqual(
		offenders,
		[],
		`injected system prompt exceeds ${PROMPT_BUDGET_BYTES} bytes — move long-form content into an agent skill:\n${offenders.join("\n")}`,
	);
});
