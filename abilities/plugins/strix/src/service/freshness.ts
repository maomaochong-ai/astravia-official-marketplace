/**
 * 更新检查：三件**本插件能自己判断**的新鲜度。
 *
 * 上游 `interface/update_check.py` 问的是"上游有没有新版本"。插件不联网（没有网络权限），
 * 所以那个问题问不了，也不该假装问得了。能问的是另外三个同样有意义的问题：
 *
 * 1. **服务产物是否与源码同步**：`dist/service/main.mjs` 的 sha256 与 `plugin.json`
 *    里盖的章不一致，说明改了服务源码却忘了构建——真机上表现为"改了没生效"。
 * 2. **技能库是哪一版**：`agent/skills/library/PROVENANCE.md` 记着来源与抓取时间。
 * 3. **沙箱镜像本地是哪一天的**：镜像在不在、多旧，能读；远端有没有更新只有
 *    `docker pull` 知道（那一步由宿主执行）。这里不猜——猜错会让人白拉几百兆。
 *
 * 三条都只读本地文件与本地 docker。
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type FreshnessState = "current" | "stale" | "unknown";

export interface FreshnessItem {
	id: "service" | "skills" | "image";
	state: FreshnessState;
	detail: string;
	/** 建议动作；`current` 时为空。 */
	action?: string;
}

export interface FreshnessReport {
	pluginVersion: string;
	items: FreshnessItem[];
	checkedAt: string;
}

function sha256(path: string): string | null {
	try {
		return createHash("sha256").update(readFileSync(path)).digest("hex");
	} catch {
		return null;
	}
}

/**
 * `plugin.json` 里盖的章：`providers.services[].runtime.platforms[<tag>].artifacts[].sha256`
 * （scripts/stamp-service.mjs 写入）。按**这一台机器**的平台取；取不到再退到任一平台——
 * 各平台的字节是同一份构建，摘要因此相同。
 */
export function stampedDigest(pluginJson: unknown, platform: string = `${process.platform}-${process.arch}`): string | null {
	const services = (pluginJson as { providers?: { services?: unknown } } | null)?.providers?.services;
	if (!Array.isArray(services)) return null;
	const platforms = (services[0] as { runtime?: { platforms?: unknown } } | null)?.runtime?.platforms;
	if (!platforms || typeof platforms !== "object") return null;
	const table = platforms as Record<string, { artifacts?: Array<{ sha256?: unknown; destination?: unknown }> }>;
	const preferred = table[platform] ?? table[Object.keys(table)[0] ?? ""];
	for (const artifact of preferred?.artifacts ?? []) {
		const sha = artifact.sha256;
		if (typeof sha === "string" && sha) return sha;
	}
	return null;
}

/** 从 PROVENANCE.md 里读上游标记：优先提交号，其次抓取日期。 */
export function skillsProvenance(text: string): string | null {
	const commit = /(?:upstream|source|来源)[^\n]*?\b([0-9a-f]{7,40})\b/i.exec(text);
	if (commit) return commit[1];
	const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
	return date ? date[1] : null;
}

export async function checkFreshness(options: {
	pluginRoot: string;
	pluginVersion: string;
	image?: string;
	/** 注入点：测试里替换掉 docker，不真的起进程。 */
	inspectImage?: (image: string) => Promise<{ created: string | null }>;
}): Promise<FreshnessReport> {
	const items: FreshnessItem[] = [];

	const pluginJson = (() => {
		try {
			return JSON.parse(readFileSync(join(options.pluginRoot, "plugin.json"), "utf8")) as unknown;
		} catch {
			return null;
		}
	})();
	const actual = sha256(join(options.pluginRoot, "dist/service/main.mjs"));
	const stamped = stampedDigest(pluginJson);
	if (!actual) {
		items.push({
			id: "service",
			state: "unknown",
			detail: "还没有构建过服务（dist/service/main.mjs 不存在）",
			action: "npm run build",
		});
	} else if (!stamped) {
		items.push({ id: "service", state: "unknown", detail: "plugin.json 里没有服务摘要，无法比对" });
	} else if (actual === stamped) {
		items.push({ id: "service", state: "current", detail: `服务产物与盖章一致（${actual.slice(0, 12)}）` });
	} else {
		items.push({
			id: "service",
			state: "stale",
			detail: `服务产物（${actual.slice(0, 12)}）与盖章（${stamped.slice(0, 12)}）不一致：改过服务但没重新构建`,
			action: "npm run build",
		});
	}

	let provenance: string | null = null;
	try {
		provenance = skillsProvenance(readFileSync(join(options.pluginRoot, "agent/skills/library/PROVENANCE.md"), "utf8"));
	} catch {
		provenance = null;
	}
	items.push(
		provenance
			? { id: "skills", state: "current", detail: `技能库随包，来源标记 ${provenance}` }
			: {
					id: "skills",
					state: "unknown",
					detail: "技能库没有可读的 PROVENANCE.md，判断不出来源版本",
					action: "node scripts/dev/vendor-skills.cjs",
				},
	);

	if (!options.image) {
		items.push({ id: "image", state: "unknown", detail: "没有配置沙箱镜像" });
	} else {
		const inspect = options.inspectImage;
		const created = inspect ? (await inspect(options.image).catch(() => ({ created: null }))).created : null;
		items.push(
			created
				? { id: "image", state: "current", detail: `本地镜像 ${options.image} 构建于 ${created.slice(0, 10)}` }
				: {
						id: "image",
						state: "unknown",
						detail: `本地还没有 ${options.image}（远端是否有更新只有拉取才知道）`,
						action: "面板上的「拉取镜像」",
					},
		);
	}

	return { pluginVersion: options.pluginVersion, items, checkedAt: new Date().toISOString() };
}

/** 服务产物的构建时间：面板上一句话就能说清"你跑的是哪一版"。 */
export function serviceBuiltAt(pluginRoot: string): string | null {
	try {
		return new Date(statSync(join(pluginRoot, "dist/service/main.mjs")).mtimeMs).toISOString();
	} catch {
		return null;
	}
}
