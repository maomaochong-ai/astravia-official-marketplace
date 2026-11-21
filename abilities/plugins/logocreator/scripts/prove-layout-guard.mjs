import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Prove the layout test is red-capable: undoing the redesign must fail it.
 * Mutates the panel back to the old order (form first, gallery last), runs only the
 * layout spec, restores the file.
 */
const FILE = "src/features/canvas/components/logo-canvas.tsx";
const original = readFileSync(FILE, "utf8");
const lines = original.split("\n");

// Move the gallery block back below the form: the pre-v0.1.0 order.
const header = lines.findIndex((l) => l.includes("mt-4 flex items-center justify-between"));
const selfClose = lines.findIndex((l, i) => i > header && l.trim() === "/>");
const end = selfClose + 2;
const block = lines.slice(header, end);
const rest = [...lines.slice(0, header), ...lines.slice(end)];
const formAt = rest.findIndex((l) => l.includes("</CanvasControls>"));
const mutated = [...rest.slice(0, formAt + 1), ...block, ...rest.slice(formAt + 1)].join("\n");

const run = () => {
	try {
		execFileSync("bunx", ["vitest", "run", "src/test/canvas-layout.test.ts"], { encoding: "utf8", stdio: "pipe" });
		return 0;
	} catch (error) {
		return error.status ?? 1;
	}
};

let red;
try {
	writeFileSync(FILE, mutated);
	red = run();
} finally {
	writeFileSync(FILE, original);
}
const green = run();
console.log(`mutated exit: ${red} · restored exit: ${green}`);
if (red === 0) throw new Error("the layout test stayed green with the gallery back at the bottom");
if (green !== 0) throw new Error("the layout test is red after restoring — the assertion is wrong");
console.log("layout test is red-capable");
