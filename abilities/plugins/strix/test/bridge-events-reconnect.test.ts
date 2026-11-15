import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridgeClient } from "../src/domain/bridge-client";

/**
 * SSE 断线必须用**新的** baseUrl 重连（1.4.1）。
 *
 * 原来的实现只在挂载时建一次 `EventSource`。服务被宿主重启（装新版本、崩溃拉起）之后
 * 端口可能变，而 EventSource 自带的自动重连记的是创建时那个 URL —— 于是它永远连不上，
 * 面板看起来还活着，只是运行记录再也不更新。那是一条静默故障，截图上看不出来。
 *
 * 这里用假的 EventSource 把"连接 → 断 → 换地址重连"跑一遍。
 */

class FakeEventSource {
	static instances: FakeEventSource[] = [];
	url: string;
	closed = false;
	onmessage: ((message: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	onopen: (() => void) | null = null;

	constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	close(): void {
		this.closed = true;
	}
}

const original = globalThis.EventSource;

beforeEach(() => {
	FakeEventSource.instances = [];
	// @ts-expect-error 测试里只要求构造/close/三个回调
	globalThis.EventSource = FakeEventSource;
	vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
	globalThis.EventSource = original;
	vi.useRealTimers();
});

const flushMicrotasks = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe("a dropped event stream comes back on the current address", () => {
	it("reconnects with the freshly resolved base URL", async () => {
		let base = "http://127.0.0.1:41000";
		const client = createBridgeClient(async () => base);
		const stop = client.events(() => undefined);
		await flushMicrotasks();

		expect(FakeEventSource.instances).toHaveLength(1);
		expect(FakeEventSource.instances[0]!.url).toBe("http://127.0.0.1:41000/api/events");

		// 服务重启：端口换了，旧连接断了。
		base = "http://127.0.0.1:42000";
		FakeEventSource.instances[0]!.onerror?.();
		expect(FakeEventSource.instances[0]!.closed).toBe(true);

		// 退避 500ms 之后重连，并且用的是**新**地址。
		await vi.advanceTimersByTimeAsync(600);
		await flushMicrotasks();
		expect(FakeEventSource.instances).toHaveLength(2);
		expect(FakeEventSource.instances[1]!.url).toBe("http://127.0.0.1:42000/api/events");

		stop();
	});

	it("backs off instead of retrying in a tight loop", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:43000");
		const stop = client.events(() => undefined);
		await flushMicrotasks();

		FakeEventSource.instances[0]!.onerror?.();
		// 立刻重试是不允许的：500ms 之前没有新连接。
		await vi.advanceTimersByTimeAsync(100);
		expect(FakeEventSource.instances).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(500);
		await flushMicrotasks();
		expect(FakeEventSource.instances).toHaveLength(2);

		stop();
	});

	it("stops reconnecting after dispose", async () => {
		const client = createBridgeClient(async () => "http://127.0.0.1:44000");
		const stop = client.events(() => undefined);
		await flushMicrotasks();
		const first = FakeEventSource.instances[0]!;
		stop();
		first.onerror?.();
		await vi.advanceTimersByTimeAsync(2000);
		expect(FakeEventSource.instances).toHaveLength(1);
	});

	it("delivers parsed events to the listener", async () => {
		const seen: unknown[] = [];
		const client = createBridgeClient(async () => "http://127.0.0.1:45000");
		const stop = client.events((event) => seen.push(event));
		await flushMicrotasks();
		FakeEventSource.instances[0]!.onmessage?.({ data: JSON.stringify({ event: "bridge_ready" }) });
		expect(seen).toEqual([{ event: "bridge_ready" }]);
		// 坏行不该把流打断。
		FakeEventSource.instances[0]!.onmessage?.({ data: "{not json" });
		expect(seen).toHaveLength(1);
		stop();
	});
});
