/**
 * 把「一步」翻译成 `sendInputEvent` 真正收的事件序列。
 *
 * 纯函数：不碰 DOM、不碰 webview，所以在 node 里就能断言点击真的会落成
 * move → down → up，而不是只发一个 down 让页面永远停在按下状态。
 */
export type BoardmixModifier = "shift" | "control" | "alt" | "meta";

export type BoardmixStep =
	| { op: "click"; x: number; y: number; button?: "left" | "right"; clicks?: number; label?: string }
	| { op: "move"; x: number; y: number }
	| { op: "type"; text: string; label?: string }
	| { op: "key"; key: string; modifiers?: BoardmixModifier[]; label?: string }
	| { op: "scroll"; x: number; y: number; dy: number; dx?: number; label?: string }
	| { op: "wait"; ms: number };

export const STEP_LIMIT = 24;
const TYPE_LIMIT = 400;

const MODIFIERS: BoardmixModifier[] = ["shift", "control", "alt", "meta"];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 入口校验：宁可回一句「哪一步不合法」，也不要发一串半截事件。 */
export function readSteps(input: unknown): BoardmixStep[] | string {
	if (!Array.isArray(input) || input.length === 0) return "steps-required";
	if (input.length > STEP_LIMIT) return `too-many-steps:${STEP_LIMIT}`;
	const steps: BoardmixStep[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const raw = input[index];
		if (!isRecord(raw)) return `step-${index}-invalid`;
		const op = raw.op;
		if (op === "click") {
			const x = num(raw.x);
			const y = num(raw.y);
			if (x === null || y === null) return `step-${index}-no-point`;
			const button = raw.button === "right" ? "right" : "left";
			const clicks = Math.min(Math.max(Math.round(num(raw.clicks) ?? 1), 1), 2);
			steps.push({ op, x: Math.round(x), y: Math.round(y), button, clicks, label: textOf(raw.label) });
			continue;
		}
		if (op === "move") {
			const x = num(raw.x);
			const y = num(raw.y);
			if (x === null || y === null) return `step-${index}-no-point`;
			steps.push({ op, x: Math.round(x), y: Math.round(y) });
			continue;
		}
		if (op === "type") {
			const text = textOf(raw.text);
			if (!text) return `step-${index}-empty-type`;
			steps.push({ op, text: text.slice(0, TYPE_LIMIT), label: textOf(raw.label) });
			continue;
		}
		if (op === "key") {
			const key = textOf(raw.key);
			if (!key) return `step-${index}-no-key`;
			const modifiers = Array.isArray(raw.modifiers)
				? raw.modifiers.filter((value): value is BoardmixModifier => MODIFIERS.includes(value as BoardmixModifier))
				: [];
			steps.push({ op, key, modifiers, label: textOf(raw.label) });
			continue;
		}
		if (op === "scroll") {
			const x = num(raw.x);
			const y = num(raw.y);
			const dy = num(raw.dy);
			if (x === null || y === null || dy === null) return `step-${index}-no-scroll`;
			steps.push({
				op,
				x: Math.round(x),
				y: Math.round(y),
				dy: Math.round(dy),
				dx: Math.round(num(raw.dx) ?? 0),
				label: textOf(raw.label),
			});
			continue;
		}
		if (op === "wait") {
			const ms = Math.min(Math.max(Math.round(num(raw.ms) ?? 250), 0), 5000);
			steps.push({ op, ms });
			continue;
		}
		return `step-${index}-unknown-op`;
	}
	return steps;
}

function textOf(value: unknown): string {
	return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** 一步 → 事件序列。click 一定是 move→down→up，且 down/up 带同一组坐标。 */
export function eventsFor(step: BoardmixStep): unknown[] {
	if (step.op === "click") {
		const { x, y } = step;
		const button = step.button ?? "left";
		const clicks = step.clicks ?? 1;
		const events: unknown[] = [
			{ type: "mouseMove", x, y },
			{ type: "mouseDown", x, y, button, clickCount: clicks },
			{ type: "mouseUp", x, y, button, clickCount: clicks },
		];
		// 双击：第二次点击单独发，页面按 clickCount=2 组合识别。
		if (clicks === 2) {
			events.push(
				{ type: "mouseDown", x, y, button, clickCount: 2 },
				{ type: "mouseUp", x, y, button, clickCount: 2 },
			);
		}
		return events;
	}
	if (step.op === "move") return [{ type: "mouseMove", x: step.x, y: step.y }];
	if (step.op === "scroll") {
		return [{ type: "mouseWheel", x: step.x, y: step.y, deltaX: step.dx ?? 0, deltaY: step.dy, canScroll: true }];
	}
	if (step.op === "type") {
		return [...step.text].map(char => ({ type: "char", keyCode: char }));
	}
	if (step.op === "key") {
		const modifiers = step.modifiers ?? [];
		const keyCode = keyCodeOf(step.key, modifiers);
		const events: unknown[] = [{ type: "keyDown", keyCode, modifiers }];
		// 单个可打印字符也要走 char，否则 React 的输入框不会收到文本。
		if (!modifiers.includes("control") && !modifiers.includes("meta") && step.key.length === 1) {
			events.push({ type: "char", keyCode: step.key, modifiers });
		}
		events.push({ type: "keyUp", keyCode, modifiers });
		return events;
	}
	return [];
}

/** Electron 的 keyCode：单字符用大写字母数字，其余用 Accelerator 名字。 */
function keyCodeOf(key: string, modifiers: BoardmixModifier[]): string {
	if (key.length === 1) return modifiers.includes("shift") ? key : key.toUpperCase();
	const named: Record<string, string> = {
		enter: "Enter",
		return: "Enter",
		tab: "Tab",
		escape: "Escape",
		esc: "Escape",
		backspace: "Backspace",
		delete: "Delete",
		space: "Space",
		up: "Up",
		down: "Down",
		left: "Left",
		right: "Right",
		home: "Home",
		end: "End",
		pageup: "PageUp",
		pagedown: "PageDown",
	};
	return named[key.toLowerCase()] ?? key;
}

/** 时间线里给人看的那一句；没有 label 就退回操作本身。 */
export function labelOf(step: BoardmixStep): string {
	const custom = "label" in step ? textOf(step.label) : "";
	if (custom) return custom;
	if (step.op === "click") return `click ${step.x},${step.y}`;
	if (step.op === "move") return `move ${step.x},${step.y}`;
	if (step.op === "type") return `type "${step.text.slice(0, 24)}"`;
	if (step.op === "key") return `key ${step.key}`;
	if (step.op === "scroll") return `scroll ${step.dy}`;
	return `wait ${step.ms}ms`;
}

/** 事件之间留一点时间给页面反应；wait 步自己就是等待。 */
export function settleMsFor(step: BoardmixStep, baseMs: number): number {
	if (step.op === "wait") return step.ms;
	if (step.op === "type") return Math.min(600, 80 + step.text.length * 12);
	if (step.op === "click") return baseMs;
	return Math.round(baseMs / 2);
}
