import type { Disposable, PluginContext, PluginFsApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { resolvePreset, scopeMarkdown, workItemsMarkdown, type CaseBrief } from "../domain/case/contract";
import { registerRecordCaseNoteTool } from "../tools/case/record-case-note";
import { registerSearchCasesTool } from "../tools/case/search-cases";

/**
 * 目录感知的内存文件树：readDir 由键的层级推出来，add/rmdir 只是记账。
 * 两个新工具真正用到的只有 readDir / readFile / writeFile / createDirectory / stat。
 */
function memoryFs(initial: Record<string, string> = {}) {
	const files = new Map<string, string>(Object.entries(initial));
	const added: string[] = [];

	const isDirectory = (path: string) =>
		added.includes(path) || [...files.keys()].some(key => key.startsWith(`${path}/`));

	const readDir = async (path: string) => {
		const base = path.replace(/\/+$/, "");
		const entries = new Map<string, { name: string; path: string; isDirectory: boolean; size: number; modifiedAt: number }>();
		for (const key of files.keys()) {
			if (!key.startsWith(`${base}/`)) continue;
			const rest = key.slice(base.length + 1);
			const name = rest.split("/")[0]!;
			const childPath = `${base}/${name}`;
			const directory = rest.includes("/");
			entries.set(name, {
				name,
				path: childPath,
				isDirectory: directory,
				size: directory ? 0 : files.get(`${childPath}`)?.length ?? files.get(key)!.length,
				modifiedAt: 0,
			});
		}
		for (const directory of added) {
			if (!directory.startsWith(`${base}/`) || directory.slice(base.length + 1).includes("/")) continue;
			const name = directory.slice(base.length + 1);
			entries.set(name, { name, path: directory, isDirectory: true, size: 0, modifiedAt: 0 });
		}
		if (entries.size === 0) throw new Error(`ENOENT ${path}`);
		return [...entries.values()];
	};

	const fs = {
		readDir,
		readFile: async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`ENOENT ${path}`);
			return { content, encoding: "utf8" as const };
		},
		writeFile: async (path: string, content: string) => {
			files.set(path, content);
		},
		createDirectory: async (path: string) => {
			added.push(path);
		},
		stat: async (path: string) => {
			if (files.has(path)) return { size: files.get(path)!.length, modifiedAt: 0, createdAt: 0 };
			return isDirectory(path) ? { size: 0, modifiedAt: 0, createdAt: 0 } : null;
		},
	} as unknown as PluginFsApi;

	return { fs, files, added };
}

function harness(initial: Record<string, string> = {}) {
	const { fs, files, added } = memoryFs(initial);
	const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];
	const ctx = {
		agent: {
			registerTool: (definition: { id: string; handler: (context: never) => unknown }): Disposable => {
				registered.push({
					id: definition.id,
					run: input =>
						definition.handler({ trigger: { input }, host: { fs }, session: { cwd: "/work" } } as never) as Promise<string>,
				});
				return { dispose: () => undefined };
			},
		},
		host: { fs },
		session: { cwd: "/work" },
	} as unknown as PluginContext;
	registerSearchCasesTool(ctx);
	registerRecordCaseNoteTool(ctx);
	const call = async (id: string, input: Record<string, unknown>) => {
		const definition = registered.find(item => item.id === id);
		if (!definition) throw new Error(`tool ${id} was not registered`);
		return definition.run(input);
	};
	return { call, files, added, fs };
}

function brief(overrides: Partial<CaseBrief> = {}): CaseBrief {
	return {
		name: "demo",
		preset: resolvePreset("offline-sample"),
		authStatus: "granted",
		authBasis: "own_system",
		sample: "samples/app.apk",
		inScope: ["app.apk"],
		outOfScope: [],
		networkProfile: "offline",
		deliverables: [],
		constraints: [],
		at: "2026-10-27T00:00:00.000Z",
		...overrides,
	};
}

function caseFiles(name: string, overrides: Partial<CaseBrief> = {}): Record<string, string> {
	const record = brief({ name, ...overrides });
	return {
		[`/work/cases/${name}/scope.md`]: scopeMarkdown(record),
		[`/work/cases/${name}/workitems.md`]: workItemsMarkdown(name, record),
	};
}

describe("search_cases", () => {
	it("lists the index and says which cases are gated", async () => {
		const { call } = harness({
			...caseFiles("alpha"),
			"/work/work/beta/scope.md": scopeMarkdown(brief({ name: "beta", authStatus: "pending", inScope: [] })),
		});
		const output = await call("search_cases", {});
		expect(output).toContain("Case index — /work (2 cases, 1 ready)");
		expect(output).toContain("### alpha — ready for act");
		expect(output).toContain("### beta — not ready");
		expect(output).toContain("- blockers: authorisation not recorded (auth_status=pending); no in-scope assets declared");
	});

	it("ranks by the query and honours ready_only and limit", async () => {
		const { call } = harness({
			...caseFiles("frida-lab"),
			"/work/cases/other/scope.md": scopeMarkdown(brief({ name: "other", authStatus: "pending" })),
		});
		expect(await call("search_cases", { query: "frida" })).toContain("### frida-lab");
		const ready = await call("search_cases", { ready_only: true });
		expect(ready).toContain("### frida-lab");
		expect(ready).not.toContain("### other");
		expect(await call("search_cases", { limit: 1 })).toContain("(2 cases, 1 ready)");
	});

	it("explains how to create the first case instead of returning an empty list", async () => {
		const output = await harness().call("search_cases", {});
		expect(output).toContain("No cases under /work.");
		expect(output).toContain("cases/*/scope.md");
		expect(output).toContain("Create one with init_task");
	});

	it("refuses a root outside the project", async () => {
		const output = await harness().call("search_cases", { root: "/etc" });
		expect(output).toContain("root must stay inside the open project");
	});

	it("reports a query that matches nothing without hiding the index size", async () => {
		const output = await harness(caseFiles("alpha")).call("search_cases", { query: "krb5" });
		expect(output).toContain("(1 case, 1 ready)");
		expect(output).toContain('No case matches "krb5".');
	});

	it("appends the shipped precedent library unless the caller turns it off", async () => {
		const { call } = harness(caseFiles("alpha"));
		const withLibrary = await call("search_cases", { query: "pinning" });
		expect(withLibrary).toContain("Case index — /work");
		expect(withLibrary).toContain("Shipped precedents —");
		expect(withLibrary).toContain("android-ssl-pin-bypass");
		// 先例不是本地案例：不能把它的 slug 读成本项目里的一个 case 目录。
		expect(withLibrary).not.toContain("### android-ssl-pin-bypass — ready for act");

		const projectOnly = await call("search_cases", { query: "pinning", library: false });
		expect(projectOnly).not.toContain("Shipped precedents");
	});
});

describe("record_case_note", () => {
	it("writes the note where upstream files it and appends the timeline", async () => {
		const { call, files } = harness({
			...caseFiles("demo"),
			"/work/cases/demo/timeline.md": "# Timeline — demo\n\n- 2026-10-27T00:00:00.000Z — case created\n",
		});
		const output = await call("record_case_note", {
			case: "cases/demo",
			status: "rejected",
			category: "feature",
			title: "Do not relay the licence server",
			body: "A relay keeps the vendor in the loop; the local check is what has to be proven.",
		});
		const notePath = [...files.keys()].find(key => key.startsWith("/work/cases/demo/.agents/notes/rejected/feature/"))!;
		expect(notePath).toMatch(/\/\d{4}-\d{2}-\d{2}-do-not-relay-the-licence-server\.md$/);
		expect(files.get(notePath)).toContain("- status: rejected");
		expect(files.get("/work/cases/demo/timeline.md")).toContain("rejected feature: Do not relay the licence server");
		expect(output).toContain("- timeline: appended to /work/cases/demo/timeline.md");
		expect(output).toContain("citable as precedent");
		// 调用方可以把 case 写成 `cases/demo`；笔记头里应该记目录名，而不是那句入参路径。
		expect(files.get(notePath)).toContain("- case: demo\n");
	});

	it("refuses to replace an existing note, and replaces it when asked", async () => {
		const { call } = harness(caseFiles("demo"));
		const note = {
			case: "cases/demo",
			status: "implemented" as const,
			category: "process",
			title: "Gate is derived",
			body: "first",
		};
		await call("record_case_note", note);
		expect(await call("record_case_note", note)).toContain("already exists; pass overwrite=true");
		const replaced = await call("record_case_note", { ...note, body: "second", overwrite: true });
		expect(replaced).toContain("Replaced ");
	});

	it("says the case does not exist instead of creating one implicitly", async () => {
		const output = await harness().call("record_case_note", {
			case: "cases/missing",
			status: "implemented",
			category: "process",
			title: "x",
			body: "y",
		});
		expect(output).toContain("case directory does not exist");
		expect(output).toContain("init_task");
	});

	it("rejects a bad status and a bad category before touching disk", async () => {
		const { call, files } = harness(caseFiles("demo"));
		expect(
			await call("record_case_note", { case: "cases/demo", status: "done", category: "x", title: "t", body: "b" }),
		).toContain('status must be "implemented" or "rejected"');
		expect(
			await call("record_case_note", { case: "cases/demo", status: "implemented", category: "  ", title: "t", body: "b" }),
		).toContain("category must contain letters");
		expect([...files.keys()].some(key => key.includes("/.agents/notes/"))).toBe(false);
	});
});
