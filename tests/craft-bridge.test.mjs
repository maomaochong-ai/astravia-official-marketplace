/**
 * Behaviour of the craft host bridge, checked against a stub DOM.
 *
 * The bridge is shipped inside every craft plugin's hub page and is the only place
 * that decides whether a hidden editor keeps drawing and what an agent gesture turns
 * into, so the properties worth pinning down are:
 *   - `craft:pause` really stops the app's next frame, and `craft:resume` really
 *     delivers it (an editor that never draws again after a tab switch is worse than
 *     a slow host);
 *   - a gesture lands on the canvas as the events upstream reads, paced so a press is
 *     not released in the same tick it started;
 *   - `craft:act` runs its steps in order, narrates each one, and reports what it did;
 *   - `craft:probe` describes the canvas in text, because a plugin tool result reaches
 *     the model as text and pixels would be useless there.
 *
 * ADR: docs/adr/<plugin>/craft-0004-inactive-tabs-stop-drawing.md
 * ADR: docs/adr/<plugin>/craft-0009-one-batch-instead-of-one-click.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const BRIDGE = new URL(
	"../abilities/plugins/designcraft/src/bridge/host-bridge.js",
	import.meta.url,
);

function makeEnv() {
	const posted = [];
	const windowListeners = new Map();
	const canvasEvents = [];
	const queue = [];
	let frameSeq = 0;
	let pixels = [0, 0, 255, 255];

	const canvas = {
		width: 1280,
		height: 720,
		focus() {},
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
		dispatchEvent(event) {
			canvasEvents.push(event);
			return true;
		},
		toDataURL: () => "data:image/png;base64,AA==",
	};

	function fakeCanvasElement() {
		return {
			width: 0,
			height: 0,
			getContext: () => ({
				imageSmoothingEnabled: false,
				drawImage() {},
				getImageData: (_x, _y, w, h) => {
					const data = new Uint8ClampedArray(w * h * 4);
					for (let index = 0; index < w * h; index++) {
						for (let channel = 0; channel < 4; channel++) {
							data[index * 4 + channel] = pixels[channel];
						}
					}
					return { data };
				},
			}),
			toDataURL: () => "data:image/png;base64,AA==",
		};
	}

	// The HUD is one reused element, so the writes are what tell the story: the last
	// text is only ever the final state.
	const hudWrites = [];
	const hud = {
		id: "astravia-craft-hud",
		style: {},
		setAttribute() {},
		get textContent() {
			return hudWrites.length ? hudWrites[hudWrites.length - 1] : "";
		},
		set textContent(value) {
			hudWrites.push(String(value));
		},
	};

	const parentWindow = { postMessage: (message) => posted.push(message) };

	const windowObject = {
		parent: parentWindow,
		requestAnimationFrame(callback) {
			frameSeq += 1;
			queue.push({ id: frameSeq, callback });
			return frameSeq;
		},
		cancelAnimationFrame(id) {
			const at = queue.findIndex((item) => item.id === id);
			if (at >= 0) queue.splice(at, 1);
		},
		addEventListener(type, handler) {
			windowListeners.set(type, handler);
		},
		removeEventListener() {},
	};

	class Element {
		click() {}
	}
	windowObject.HTMLInputElement = Element;
	windowObject.HTMLAnchorElement = Element;

	class FakeEvent {
		constructor(type, init = {}) {
			this.type = type;
			this.bubbles = !!init.bubbles;
			this.cancelable = !!init.cancelable;
			this.defaultPrevented = false;
			Object.assign(this, init);
		}
		preventDefault() {
			this.defaultPrevented = true;
		}
	}

	const documentObject = {
		body: { appendChild() {} },
		getElementById: (id) => (id === hud.id ? hud : null),
		createElement: (tag) => (tag === "canvas" ? fakeCanvasElement() : hud),
		querySelector: (selector) => (String(selector).includes("canvas") ? canvas : null),
	};

	const sandbox = {
		window: windowObject,
		document: documentObject,
		location: { href: "http://127.0.0.1:9/?hl=zh" },
		navigator: {},
		parent: parentWindow,
		HTMLInputElement: Element,
		HTMLAnchorElement: Element,
		Event: FakeEvent,
		MouseEvent: FakeEvent,
		PointerEvent: FakeEvent,
		KeyboardEvent: FakeEvent,
		WheelEvent: FakeEvent,
		File: class {},
		Blob: class {},
		DataTransfer: class {},
		setInterval: () => 0,
		clearInterval: () => {},
		// Real timers: the bridge paces itself with `setTimeout` between a press and
		// its release, so a no-op stub would hang every gesture.
		setTimeout: (callback, ms) => setTimeout(callback, 0, ms),
		clearTimeout: (handle) => clearTimeout(handle),
		atob: (value) => Buffer.from(value, "base64").toString("binary"),
		Uint8Array,
		Uint8ClampedArray,
		Map,
		Error,
		Date,
		Promise,
		console,
	};

	vm.runInNewContext(readFileSync(BRIDGE, "utf8"), sandbox, { filename: "host-bridge.js" });

	const send = (data) => {
		windowListeners.get("message")({ source: parentWindow, data });
	};

	/** Drain the frames the bridge asked for; a callback may ask for the next one. */
	const runFrames = () => {
		for (let pass = 0; pass < 40 && queue.length > 0; pass++) {
			const batch = queue.splice(0, queue.length);
			for (const item of batch) item.callback(0);
		}
	};

	/** Wait for a reply, pumping frames — the bridge waits on frames, not on the clock. */
	const settle = (id, timeoutMs = 2000) =>
		new Promise((resolve, reject) => {
			const started = Date.now();
			(function tick() {
				runFrames();
				const reply = posted.find((message) => message.type === "craft:reply" && message.id === id);
				if (reply) return resolve(reply);
				if (Date.now() - started > timeoutMs) return reject(new Error(`no reply for ${id}`));
				setTimeout(tick, 1);
			})();
		});

	return {
		send,
		posted,
		canvasEvents,
		queue,
		runFrames,
		settle,
		windowObject,
		hud,
		hudWrites,
		setPixels: (value) => {
			pixels = value;
		},
	};
}

test("an inactive editor stops asking for frames and starts again on resume", () => {
	const env = makeEnv();
	const drawn = [];

	// Baseline: with the tab visible, a frame request reaches the browser.
	env.windowObject.requestAnimationFrame(() => drawn.push("first"));
	assert.equal(env.queue.length, 1);

	env.send({ type: "craft:pause" });
	const held = env.windowObject.requestAnimationFrame(() => drawn.push("held"));
	assert.equal(held, -1, "a paused request gets one of our own negative ids");
	assert.equal(env.queue.length, 1, "no new frame reaches the browser while paused");
	assert.equal(drawn.length, 0);

	env.send({ type: "craft:resume" });
	assert.equal(env.queue.length, 2, "the held frame is scheduled exactly once on resume");

	// Cancelling a held frame before resume must not resurrect it.
	env.send({ type: "craft:pause" });
	const cancelled = env.windowObject.requestAnimationFrame(() => drawn.push("cancelled"));
	env.windowObject.cancelAnimationFrame(cancelled);
	env.send({ type: "craft:resume" });
	assert.equal(env.queue.length, 2, "a cancelled held frame is dropped, not delivered");
});

test("a pointer request is paced: move, press, release, click", async () => {
	const env = makeEnv();
	env.send({ type: "craft:pointer", id: "p1", x: 0.25, y: 0.5 });

	const reply = await env.settle("p1");
	assert.equal(reply.ok, true);

	const types = env.canvasEvents.map((event) => event.type);
	assert.deepEqual(types, ["pointermove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]);

	const down = env.canvasEvents.find((event) => event.type === "pointerdown");
	assert.equal(down.clientX, 250, "x is a fraction of the canvas box");
	assert.equal(down.clientY, 250);
	assert.equal(down.buttons, 1);
});

test("a batch runs its steps in order, narrates them and reports each result", async () => {
	const env = makeEnv();
	env.send({
		type: "craft:act",
		id: "a1",
		hud: { prefix: "自动操作", done: "完成" },
		steps: [
			{ op: "click", x: 0.1, y: 0.1, label: "点击工具栏" },
			{ op: "type", text: "Hi", label: "输入文字" },
			{ op: "key", key: "ctrl+s", label: "保存" },
		],
	});

	const reply = await env.settle("a1");
	assert.equal(reply.ok, true);
	assert.equal(reply.steps.length, 3);
	// Spread: the reply was built in the vm realm, and a cross-realm array does not
	// deep-equal a host array even when the values match.
	assert.deepEqual(
		[...reply.steps.map((step) => step.op)],
		["click", "type", "key"],
	);
	assert.ok(reply.steps.every((step) => step.ok), "every step reports success");

	const progress = env.posted.filter((message) => message.type === "craft:progress");
	assert.equal(progress.length, 3, "one progress message per step");
	assert.equal(progress[0].index, 0);
	assert.equal(progress[0].total, 3);
	assert.equal(progress[0].label, "点击工具栏");

	assert.ok(
		env.hudWrites.includes("自动操作 1/3 · 点击工具栏"),
		`the first step is named on the canvas, got ${JSON.stringify(env.hudWrites)}`,
	);
	assert.equal(env.hud.textContent, "完成", "the HUD settles on the done text");

	const keys = env.canvasEvents.filter((event) => event.type === "keydown").map((event) => event.key);
	assert.deepEqual(keys, ["H", "i", "ctrl", "s"]);
	const save = env.canvasEvents.find((event) => event.type === "keydown" && event.key === "s");
	assert.equal(save.ctrlKey, true);
});

test("a failing step stops the batch unless it is told not to", async () => {
	const env = makeEnv();
	env.send({
		type: "craft:act",
		id: "a2",
		steps: [{ op: "nonsense", label: "坏步骤" }, { op: "click", x: 0.5, y: 0.5, label: "还不该到这里" }],
	});

	const reply = await env.settle("a2");
	assert.equal(reply.ok, false);
	assert.equal(reply.steps[0].ok, false);
	assert.equal(reply.steps[0].error, "unknown-step:nonsense");
	assert.equal(reply.steps[1].error, "skipped");
});

test("typed text and a key chord arrive as key events", async () => {
	const env = makeEnv();
	env.send({ type: "craft:key", id: "k1", text: "A4", key: "ctrl+s" });

	const reply = await env.settle("k1");
	assert.equal(reply.typed, 2);

	const keys = env.canvasEvents.filter((event) => event.type === "keydown").map((event) => event.key);
	assert.deepEqual(keys, ["A", "4", "ctrl", "s"]);
});

test("a probe describes the canvas in text and measures its colour", async () => {
	const env = makeEnv();
	env.setPixels([0, 0, 255, 255]); // pure blue everywhere
	env.send({ type: "craft:probe", id: "q1", columns: 8, rows: 4 });

	const reply = await env.settle("q1");
	assert.equal(reply.ok, true);
	const cells = reply.probe.cells.split("\n");
	assert.equal(cells.length, 4, "one line per row");
	assert.equal(cells[0].length, 8, "one letter per column");
	assert.equal(cells[0], "BBBBBBBB", "blue reads as B");
	assert.equal(reply.probe.mean, "#0000ff");
	assert.deepEqual([...reply.probe.meanRgb], [0, 0, 255]);

	// A dark neutral surface must read as K, not as a hue.
	env.setPixels([16, 16, 16, 255]);
	env.send({ type: "craft:probe", id: "q2", columns: 4, rows: 2 });
	const dark = await env.settle("q2");
	assert.equal(dark.probe.cells.split("\n")[0], "KKKK");
	assert.equal(dark.probe.contrast, 0, "a flat fill has no contrast");
});
