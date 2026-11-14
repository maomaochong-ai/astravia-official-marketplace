import type { PluginCommandApi, PluginNetworkApi, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { loopbackAddress, RuntimeManager, type RuntimeState } from "../src/runtime-manager";

const SHA = "eaddd4073f03d0d976bb24d393a1d96a5c8346b6d68d01c3688eb8bccdb94334";
const URL_ARM = "https://github.com/yetone/magpie-releases/releases/download/v0.1.3336/magpie-cli-darwin-arm64";

const FEED = {
	version: "0.1.3336",
	assets: {
		"magpie-cli-darwin-arm64": { url: URL_ARM, size: 69149314, sha256: SHA },
	},
};

interface Harness {
	manager: RuntimeManager;
	states: RuntimeState[];
	scripts: Array<{ file: string; script: string; env?: Record<string, string> }>;
	files: Map<string, string>;
	stopCalls: () => number;
	/** 让下一次 spawn 的安装以这个退出码结束。 */
	nextExit: (code: number) => void;
	/** 探针现在报「已安装」。 */
	setInstalled: (value: boolean) => void;
	/** 让 spawn 本身抛错，模拟宿主拒绝执行 sh。 */
	failSpawn: (message: string | null) => void;
	/** 让 run 本身抛错，模拟系统上根本没有 sh（Windows）。 */
	failRun: (message: string | null) => void;
	/** 让下一次安装的 status() 依次报这几帧输出，最后一帧视为结束。 */
	progressFrames: (frames: string[]) => void;
}

function harness(): Harness {
	let installed = false;
	let spawnExit = 0;
	let spawnError: string | null = null;
	let runError: string | null = null;
	let stops = 0;
	let frames: string[] = [];
	let frameIndex = 0;
	const states: RuntimeState[] = [];
	const scripts: Harness["scripts"] = [];
	const files = new Map<string, string>();

	const command = {
		run: async (file: string, args?: string[]) => {
			const script = args?.[1] ?? "";
			scripts.push({ file, script });
			if (runError) throw new Error(runError);
			if (script.includes("uname")) return { stdout: "Darwin\narm64\n", stderr: "", exitCode: 0 };
			return installed
				? { stdout: "path=/Users/me/.local/bin/magpie\nmagpie 0.1.3336\n", stderr: "", exitCode: 0 }
				: { stdout: "", stderr: "", exitCode: 127 };
		},
		spawn: async (file: string, args?: string[], options?: { env?: Record<string, string> }) => {
			const script = args?.[1] ?? "";
			scripts.push({ file, script, env: options?.env });
			if (spawnError) throw new Error(spawnError);
			if (script.includes("serve")) {
				return {
					spawnId: "srv",
					pid: 4242,
					stop: async () => {
						stops += 1;
					},
					status: async () => ({ running: true, pid: 4242, recentOutput: "listening on 127.0.0.1:3425" }),
					onExit: () => ({ dispose() {} }),
				};
			}
			// 安装脚本：走到这里就说明真的「装上了」
			installed = spawnExit === 0;
			const scripted = frames.length > 0;
			return {
				spawnId: "inst",
				pid: 4343,
				stop: async () => {
					stops += 1;
				},
				status: async () => {
					if (!scripted) {
						return {
							running: false,
							pid: 4343,
							exit: { exitCode: spawnExit },
							recentOutput: spawnExit === 0 ? "installed /Users/me/.local/bin/magpie" : "checksum mismatch: got deadbeef",
						};
					}
					// 一帧一帧地喂：模拟观察者每秒往输出里写一行 `progress`
					const recentOutput = frames[Math.min(frameIndex, frames.length - 1)];
					const done = frameIndex >= frames.length - 1;
					frameIndex += 1;
					return { running: !done, pid: 4343, exit: done ? { exitCode: spawnExit } : undefined, recentOutput };
				},
				onExit: () => ({ dispose() {} }),
			};
		},
	} as unknown as PluginCommandApi;

	const network = {
		request: async () => ({ ok: true, status: 200, statusText: "", headers: {}, body: FEED }),
	} as unknown as PluginNetworkApi;

	const storage = {
		readFile: async (path: string) => files.get(path) ?? null,
		writeFile: async (path: string, data: string) => {
			files.set(path, data);
			return { revision: "1" };
		},
	} as unknown as PluginStorageApi;

	const manager = new RuntimeManager({
		command,
		network,
		storage,
		endpoint: () => "http://127.0.0.1:3425",
		onChanged: (state) => states.push(state),
	});

	return {
		manager,
		states,
		scripts,
		files,
		stopCalls: () => stops,
		nextExit: (code) => {
			spawnExit = code;
		},
		setInstalled: (value) => {
			installed = value;
		},
		failSpawn: (message) => {
			spawnError = message;
		},
		failRun: (message) => {
			runError = message;
		},
		progressFrames: (value) => {
			frames = value;
			frameIndex = 0;
		},
	};
}

describe("RuntimeManager.hydrate", () => {
	it("reports an absent binary and writes nothing", async () => {
		const h = harness();
		await h.manager.hydrate();
		expect(h.manager.getState()).toMatchObject({ phase: "absent", desiredRunning: false });
		expect(h.files.size).toBe(0);
	});

	it("reports the installed binary with its own version", async () => {
		const h = harness();
		h.setInstalled(true);
		await h.manager.hydrate();
		expect(h.manager.getState()).toMatchObject({ phase: "stopped", version: "0.1.3336", binPath: "/Users/me/.local/bin/magpie" });
	});
});

describe("RuntimeManager.install", () => {
	it("downloads the host asset, verifies it, then reports installed", async () => {
		const h = harness();
		expect(await h.manager.install()).toBe(true);
		const install = h.scripts.find((entry) => entry.script.includes("curl"));
		expect(install?.file).toBe("sh");
		expect(install?.script).toContain(URL_ARM);
		expect(install?.script).toContain(SHA);
		expect(h.manager.getState()).toMatchObject({ phase: "stopped", releaseVersion: "0.1.3336" });
	});

	it("surfaces the failing line when the checksum does not match", async () => {
		const h = harness();
		h.nextExit(4);
		expect(await h.manager.install()).toBe(false);
		expect(h.manager.getState()).toMatchObject({
			phase: "failed",
			messageKey: "runtime.installFailed",
			detail: "checksum mismatch: got deadbeef",
		});
	});

	it("moves the byte counter while the download runs, without leaving the downloading phase", async () => {
		const h = harness();
		h.progressFrames([
			"downloading magpie-cli-darwin-arm64 0.1.3336 (69149314 bytes)\nprogress 0 69149314",
			"progress 20971520 69149314",
			"progress 69149314 69149314\nverifying",
		]);
		expect(await h.manager.install()).toBe(true);
		// states 是每次 set 的整份快照，同一帧会跟着 detail 更新重复出现，所以按值去重
		const counts = h.states
			.filter((state) => state.progress !== undefined)
			.map((state) => state.progress?.downloaded)
			.filter((value, index, all) => index === 0 || all[index - 1] !== value);
		expect(counts).toEqual([0, 20971520, 69149314]);
		// 这一探只问「在不在」，不能把面板从「正在下载」打回「还没有 magpie」
		expect(h.states.some((state) => state.phase === "checking" || state.phase === "absent")).toBe(false);
		// 收尾：进度与子步骤都要清掉，否则面板会一直挂着一条 100% 的进度条
		expect(h.manager.getState()).toMatchObject({ phase: "stopped", progress: undefined, installStep: undefined });
	});

	it("maps a refused command to the one thing the user can fix", async () => {
		const h = harness();
		h.failSpawn("Command not declared: sh");
		expect(await h.manager.install()).toBe(false);
		expect(h.manager.getState()).toMatchObject({ phase: "failed", messageKey: "runtime.denied" });
	});

	it("says no shell exists when neither sh nor powershell can run", async () => {
		// 能执行的东西一个都没有：这不是「平台没有构建」（Windows 是有官方 .exe 的），
		// 而是插件根本没有执行面 —— 文案与 detail 必须指向后者。
		const h = harness();
		h.failRun("spawn sh ENOENT");
		expect(await h.manager.install()).toBe(false);
		const state = h.manager.getState();
		expect(state).toMatchObject({ phase: "failed", messageKey: "runtime.noShell" });
		expect(state.detail).toContain("sh");
	});

	it("skips the download when the binary is already there", async () => {
		const h = harness();
		h.setInstalled(true);
		expect(await h.manager.install()).toBe(true);
		expect(h.scripts.some((entry) => entry.script.includes("curl"))).toBe(false);
	});
});

describe("RuntimeManager.start", () => {
	it("runs magpie serve with the panel's port and remembers the wish", async () => {
		const h = harness();
		h.setInstalled(true);
		await h.manager.hydrate();
		expect(await h.manager.start()).toBe(true);

		const serve = h.scripts.find((entry) => entry.script.includes('exec "$bin" serve'));
		expect(serve?.file).toBe("sh");
		expect(serve?.script).toContain('exec "$bin" serve');
		expect(serve?.env).toEqual({ MAGPIE_ADDR: "127.0.0.1:3425" });
		expect(h.manager.getState()).toMatchObject({ phase: "running", pid: 4242, desiredRunning: true });
		expect(JSON.parse(h.files.get("runtime.json") ?? "{}")).toEqual({ desiredRunning: true });
	});

	it("starts the binary the probe found, not only the plugin install slot", async () => {
		const h = harness();
		h.setInstalled(true);
		await h.manager.hydrate();
		// 用户自己的 ~/bin/magpie 也算数，否则会出现「检测到已安装、启动却说找不到」
		expect(h.manager.getState().binPath).toBe("/Users/me/.local/bin/magpie");
		await h.manager.start();
		const serve = h.scripts.find((entry) => entry.script.includes('exec "$bin" serve'));
		expect(serve?.script).toContain("bin='/Users/me/.local/bin/magpie'");
	});

	it("stops the process and does not ask for it again", async () => {
		const h = harness();
		h.setInstalled(true);
		await h.manager.hydrate();
		await h.manager.start();
		await h.manager.stop();
		expect(h.stopCalls()).toBe(1);
		expect(h.manager.getState()).toMatchObject({ phase: "stopped", desiredRunning: false });
		expect(JSON.parse(h.files.get("runtime.json") ?? "{}")).toEqual({ desiredRunning: false });
	});
});

describe("RuntimeManager.autostartIfWanted", () => {
	it("stays out of the way unless the user asked for it", async () => {
		const h = harness();
		h.setInstalled(true);
		await h.manager.hydrate();
		await h.manager.autostartIfWanted(true);
		expect(h.manager.getState().phase).toBe("stopped");
	});

	it("brings the gateway back when it was wanted and the gateway is down", async () => {
		const h = harness();
		h.setInstalled(true);
		h.files.set("runtime.json", JSON.stringify({ desiredRunning: true }));
		await h.manager.hydrate();
		await h.manager.autostartIfWanted(true);
		expect(h.manager.getState()).toMatchObject({ phase: "running", pid: 4242 });
	});

	it("does nothing when the gateway already answers", async () => {
		const h = harness();
		h.setInstalled(true);
		h.files.set("runtime.json", JSON.stringify({ desiredRunning: true }));
		await h.manager.hydrate();
		await h.manager.autostartIfWanted(false);
		expect(h.manager.getState().phase).toBe("stopped");
	});
});

describe("loopbackAddress", () => {
	it("only manages the port of a local gateway", () => {
		expect(loopbackAddress("http://127.0.0.1:3425")).toBe("127.0.0.1:3425");
		expect(loopbackAddress("http://localhost:3499")).toBe("localhost:3499");
		expect(loopbackAddress("http://192.168.1.9:3425")).toBeUndefined();
		expect(loopbackAddress("http://127.0.0.1")).toBeUndefined();
		expect(loopbackAddress("not a url")).toBeUndefined();
	});
});
