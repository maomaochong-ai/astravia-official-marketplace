/**
 * Behaviour of the craft host bridge, checked against a stub DOM.
 *
 * The bridge is shipped inside every craft plugin's hub page and is the only place
 * that decides whether a hidden editor keeps drawing, so the two properties worth
 * pinning down are:
 *   - `craft:pause` really stops the app's next frame, and `craft:resume` really
 *     delivers it (an editor that never draws again after a tab switch is worse than
 *     a slow host);
 *   - a gesture the Agent asks for lands on the canvas as the events upstream reads.
 *
 * ADR: docs/adr/<plugin>/craft-0004-inactive-tabs-stop-drawing.md
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
	const frames = new Map();
	let frameSeq = 0;

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

	const parentWindow = { postMessage: (message) => posted.push(message) };

	const windowObject = {
		parent: parentWindow,
		requestAnimationFrame(callback) {
			frameSeq += 1;
			frames.set(frameSeq, callback);
			return frameSeq;
		},
		cancelAnimationFrame(id) {
			frames.delete(id);
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

	const sandbox = {
		window: windowObject,
		document: { querySelector: (selector) => (String(selector).includes("canvas") ? canvas : null) },
		location: { href: "http://127.0.0.1:9/?hl=zh" },
		navigator: {},
		parent: parentWindow,
		HTMLInputElement: Element,
		HTMLAnchorElement: Element,
		Event: FakeEvent,
		MouseEvent: FakeEvent,
		PointerEvent: FakeEvent,
		KeyboardEvent: FakeEvent,
		File: class {},
		Blob: class {},
		DataTransfer: class {},
		setInterval: () => 0,
		clearInterval: () => {},
		setTimeout: () => 0,
		clearTimeout: () => {},
		atob: (value) => Buffer.from(value, "base64").toString("binary"),
		Uint8Array,
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

	return { send, posted, canvasEvents, frames, windowObject };
}

test("an inactive editor stops asking for frames and starts again on resume", () => {
	const env = makeEnv();
	const drawn = [];

	// Baseline: with the tab visible, a frame request reaches the browser.
	env.windowObject.requestAnimationFrame(() => drawn.push("first"));
	assert.equal(env.frames.size, 1);

	env.send({ type: "craft:pause" });
	const held = env.windowObject.requestAnimationFrame(() => drawn.push("held"));
	assert.equal(held, -1, "a paused request gets one of our own negative ids");
	assert.equal(env.frames.size, 1, "no new frame reaches the browser while paused");
	assert.equal(drawn.length, 0);

	env.send({ type: "craft:resume" });
	assert.equal(env.frames.size, 2, "the held frame is scheduled exactly once on resume");

	// Cancelling a held frame before resume must not resurrect it.
	env.send({ type: "craft:pause" });
	const cancelled = env.windowObject.requestAnimationFrame(() => drawn.push("cancelled"));
	env.windowObject.cancelAnimationFrame(cancelled);
	env.send({ type: "craft:resume" });
	assert.equal(env.frames.size, 2, "a cancelled held frame is dropped, not delivered");
});

test("a pointer request lands on the canvas at the requested fraction", () => {
	const env = makeEnv();
	env.send({ type: "craft:pointer", id: "p1", x: 0.25, y: 0.5 });

	const types = env.canvasEvents.map((event) => event.type);
	assert.deepEqual(types, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);

	const down = env.canvasEvents[0];
	assert.equal(down.clientX, 250);
	assert.equal(down.clientY, 250);

	const reply = env.posted.find((message) => message.type === "craft:reply" && message.id === "p1");
	assert.equal(reply?.ok, true);
});

test("typed text and a key chord arrive as key events", () => {
	const env = makeEnv();
	env.send({ type: "craft:key", id: "k1", text: "A4", key: "ctrl+s" });

	const keys = env.canvasEvents.filter((event) => event.type === "keydown").map((event) => event.key);
	assert.deepEqual(keys, ["A", "4", "ctrl", "s"]);

	const save = env.canvasEvents.find((event) => event.type === "keydown" && event.key === "s");
	assert.equal(save.ctrlKey, true);

	const reply = env.posted.find((message) => message.type === "craft:reply" && message.id === "k1");
	assert.equal(reply?.typed, 2);
});
