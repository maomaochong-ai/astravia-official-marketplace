/**
 * 本机统计（遥测的诚实形态）。
 *
 * 上游 `telemetry/` 会把匿名的使用数据发回厂商。本插件**不联网**：`plugin.json` 没有网络
 * 权限，Panel 也不该在用户不知情时往外发东西。所以这里做的是同一件事的另一半——
 * **统计**：哪些工具真被用了、一次评估多长、发现多少——只写本机数据目录，从不外发。
 *
 * 为什么值得做：它能回答"这个插件的功能到底被用到了没有"，而回答这个问题的唯一证据
 * 是计数，不是印象。面板把它显示成「本机统计」并注明不外发，用户就不会误解。
 *
 * 不做的事（也是它与上游的边界）：不采内容（命令正文、目标、发现标题一律不记），
 * 不带机器标识，不写时间戳以外的可见身份，不主动上传，不提供关闭开关（因为它本来就
 * 没有外部副作用）。要清空就直接删 `telemetry.json`。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface TelemetrySnapshot {
	/** 服务被启动过几次。 */
	serviceStarts: number;
	/** 建过几个沙箱（一次评估算一个）。 */
	assessments: number;
	/** 工具名 → 调用次数。只有名字，没有参数。 */
	toolCalls: Record<string, number>;
	/** 记过多少条发现（只计数，不含标题）。 */
	findings: number;
	/** 最长一次评估的分钟数。 */
	longestAssessmentMinutes: number;
	updatedAt: string;
}

const EMPTY: TelemetrySnapshot = {
	serviceStarts: 0,
	assessments: 0,
	toolCalls: {},
	findings: 0,
	longestAssessmentMinutes: 0,
	updatedAt: new Date(0).toISOString(),
};

function file(dataDir: string): string {
	return join(dataDir, "telemetry.json");
}

export class Telemetry {
	private state: TelemetrySnapshot = { ...EMPTY, toolCalls: {} };
	private loaded = false;

	constructor(private readonly dir: string) {}

	private async load(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		try {
			const parsed = JSON.parse(await readFile(file(this.dir), "utf8")) as Partial<TelemetrySnapshot>;
			this.state = {
				...EMPTY,
				...parsed,
				toolCalls: { ...(parsed.toolCalls ?? {}) },
			};
		} catch {
			/* 首次运行：保持空表 */
		}
	}

	private async flush(): Promise<void> {
		this.state.updatedAt = new Date().toISOString();
		await mkdir(this.dir, { recursive: true }).catch(() => undefined);
		await writeFile(file(this.dir), `${JSON.stringify(this.state, null, 2)}\n`, "utf8").catch(() => undefined);
	}

	async serviceStarted(): Promise<void> {
		await this.load();
		this.state.serviceStarts += 1;
		await this.flush();
	}

	async assessmentStarted(): Promise<void> {
		await this.load();
		this.state.assessments += 1;
		await this.flush();
	}

	async toolCalled(name: string): Promise<void> {
		await this.load();
		this.state.toolCalls[name] = (this.state.toolCalls[name] ?? 0) + 1;
		await this.flush();
	}

	async findingRecorded(count = 1): Promise<void> {
		await this.load();
		this.state.findings += count;
		await this.flush();
	}

	async assessmentEnded(minutes: number): Promise<void> {
		await this.load();
		if (minutes > this.state.longestAssessmentMinutes) {
			this.state.longestAssessmentMinutes = Math.round(minutes * 10) / 10;
			await this.flush();
		}
	}

	async snapshot(): Promise<TelemetrySnapshot & { topTools: Array<{ name: string; calls: number }> }> {
		await this.load();
		const topTools = Object.entries(this.state.toolCalls)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 6)
			.map(([name, calls]) => ({ name, calls }));
		return { ...this.state, toolCalls: { ...this.state.toolCalls }, topTools };
	}
}
