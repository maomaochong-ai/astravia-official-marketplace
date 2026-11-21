import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Prove the hydration loop is red without the guard.
 *
 * A regression test that never failed on the bug is not a regression test. This
 * removes the `await this.ready()` from `add`, runs the loop, restores the file,
 * and fails loudly if the loop stayed green.
 */
const FILE = "src/domain/history-store.ts";
const original = readFileSync(FILE, "utf8");
const mutated = original.replace(
	/async add\(draft: DesignDraft\): Promise<DesignRecord> \{\n\t\tawait this\.ready\(\);/,
	"async add(draft: DesignDraft): Promise<DesignRecord> {",
);

if (mutated === original) throw new Error("could not find the guard to remove — did the method change shape?");

const run = () => {
	try {
		execFileSync("bunx", ["vitest", "run", "src/test/history-hydration.test.ts"], { encoding: "utf8", stdio: "pipe" });
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
if (redExit === 0) throw new Error("the loop stayed green without the guard — it does not test the bug");
if (greenExit !== 0) throw new Error("the loop is red after restoring the guard — the guard is wrong");
console.log("loop is red-capable: green with the guard, red without it");
