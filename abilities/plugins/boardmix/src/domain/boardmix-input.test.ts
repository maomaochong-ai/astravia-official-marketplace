import { describe, expect, it } from "vitest";
import { eventsFor, labelOf, readSteps, settleMsFor, STEP_LIMIT } from "./boardmix-input";

describe("readSteps", () => {
	it("keeps a well-formed batch in order", () => {
		const steps = readSteps([
			{ op: "click", x: 12.4, y: 88.6, label: "打开分享" },
			{ op: "type", text: "季度复盘" },
			{ op: "key", key: "Enter" },
		]);
		expect(Array.isArray(steps)).toBe(true);
		if (typeof steps === "string") return;
		expect(steps).toHaveLength(3);
		expect(steps[0]).toEqual({ op: "click", x: 12, y: 89, button: "left", clicks: 1, label: "打开分享" });
	});

	it("refuses the whole batch when one step has no point", () => {
		expect(readSteps([{ op: "click", y: 10 }])).toBe("step-0-no-point");
		expect(readSteps([{ op: "type", text: "   " }])).toBe("step-0-empty-type");
		expect(readSteps([{ op: "explode" }])).toBe("step-0-unknown-op");
		expect(readSteps([])).toBe("steps-required");
	});

	it("caps the batch instead of truncating it silently", () => {
		const many = Array.from({ length: STEP_LIMIT + 1 }, () => ({ op: "wait", ms: 1 }));
		expect(readSteps(many)).toBe(`too-many-steps:${STEP_LIMIT}`);
	});
});

describe("eventsFor", () => {
	it("always releases the button it pressed", () => {
		const events = eventsFor({ op: "click", x: 40, y: 50, button: "left", clicks: 1 }) as Array<{
			type: string;
			x?: number;
			button?: string;
		}>;
		expect(events.map(event => event.type)).toEqual(["mouseMove", "mouseDown", "mouseUp"]);
		for (const event of events.slice(1)) {
			expect(event.x).toBe(40);
			expect(event.button).toBe("left");
		}
	});

	it("sends a double click as two press/release pairs", () => {
		const events = eventsFor({ op: "click", x: 1, y: 2, button: "left", clicks: 2 });
		expect(events).toHaveLength(5);
	});

	it("types text as character events, one per code point", () => {
		const events = eventsFor({ op: "type", text: "ab" }) as Array<{ type: string; keyCode: string }>;
		expect(events).toEqual([
			{ type: "char", keyCode: "a" },
			{ type: "char", keyCode: "b" },
		]);
	});

	it("gives Enter a keyCode the page recognises", () => {
		const events = eventsFor({ op: "key", key: "enter", modifiers: [] }) as Array<{ type: string; keyCode: string }>;
		expect(events[0].keyCode).toBe("Enter");
		expect(events.map(event => event.type)).toEqual(["keyDown", "keyUp"]);
	});

	it("does not send a char for a shortcut, so ⌘K stays a shortcut", () => {
		const events = eventsFor({ op: "key", key: "k", modifiers: ["meta"] }) as Array<{ type: string }>;
		expect(events.map(event => event.type)).toEqual(["keyDown", "keyUp"]);
	});

	it("turns a scroll into a wheel event at the given point", () => {
		const events = eventsFor({ op: "scroll", x: 5, y: 6, dy: 320, dx: 0 }) as Array<Record<string, unknown>>;
		expect(events[0]).toMatchObject({ type: "mouseWheel", x: 5, y: 6, deltaY: 320 });
	});
});

describe("labelOf / settleMsFor", () => {
	it("prefers the label the model wrote", () => {
		expect(labelOf({ op: "click", x: 1, y: 2, label: "点开导出" })).toBe("点开导出");
		expect(labelOf({ op: "click", x: 1, y: 2 })).toBe("click 1,2");
	});

	it("waits longer for a click than for a keypress", () => {
		const click = settleMsFor({ op: "click", x: 0, y: 0 }, 400);
		const key = settleMsFor({ op: "key", key: "Tab" }, 400);
		expect(click).toBe(400);
		expect(key).toBe(200);
		expect(settleMsFor({ op: "wait", ms: 900 }, 400)).toBe(900);
	});
});
