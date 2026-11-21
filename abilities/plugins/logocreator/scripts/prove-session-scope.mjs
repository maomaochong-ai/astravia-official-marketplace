import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Prove the isolation test is red without the scoping.
 *
 * Mutates `pending-design` back to one global slot (drop the scope from the key) and
 * runs only that spec; restores on the way out.
 */
const FILE = "src/features/canvas/pending-design.ts";
const original = readFileSync(FILE, "utf8");
const mutated = original
	.replace("const key = scopeKey(cwd);", 'const key = "__global__";')
	.replace("pending.set(scopeKey(cwd), id);", 'pending.set("__global__", id);')
	.replace("return pending.get(scopeKey(cwd)) ?? null;", 'return pending.get("__global__") ?? null;');

if (mutated === original) throw new Error("could not remove the scoping");

const run = () => {
	try {
		execFileSync("bunx", ["vitest", "run", "src/test/session-scope.test.ts"], { encoding: "utf8", stdio: "pipe" });
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
if (red === 0) throw new Error("the isolation test stayed green without the scope key");
if (green !== 0) throw new Error("the isolation test is red with the scope restored — the assertion is wrong");
console.log("isolation test is red-capable");
