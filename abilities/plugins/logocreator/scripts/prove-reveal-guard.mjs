import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Prove the reveal loop is red when the panel stops claiming the pending id.
 *
 * Removing the claim makes the panel fall back to "newest stored", which is exactly
 * the bug: a tool that produced an older record, or the first record of a run, would
 * not be the one on screen.
 */
const FILE = "src/features/canvas/components/logo-canvas.tsx";
const original = readFileSync(FILE, "utf8");

const mutated = original.replace(
	/\t\tif \(peekPendingDesignId\(\)\) \{\n\t\t\trevealPending\(\);\n\t\t\treturn;\n\t\t\}/,
	"\t\tif (false) {\n\t\t\trevealPending();\n\t\t\treturn;\n\t\t}",
);

if (mutated === original) throw new Error("could not find the claim branch — did the effect change shape?");

const run = () => {
	try {
		execFileSync("bunx", ["vitest", "run", "src/test/panel-reveal.test.tsx"], { encoding: "utf8", stdio: "pipe" });
		return 0;
	} catch (error) {
		return error.status ?? 1;
	}
};

let redExit;
try {
	writeFileSync(FILE, mutated);
	redExit = run();
} finally {
	writeFileSync(FILE, original);
}

const greenExit = run();
console.log(`mutated exit: ${redExit} · restored exit: ${greenExit}`);
if (redExit === 0) throw new Error("the reveal loop stayed green without the claim — it does not test the bug");
if (greenExit !== 0) throw new Error("the reveal loop is red with the claim restored — the claim is wrong");
console.log("loop is red-capable: green with the claim, red without it");
