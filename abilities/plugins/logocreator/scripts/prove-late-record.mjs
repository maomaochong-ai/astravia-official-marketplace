import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Prove the late-record test is red without the fix.
 *
 * Restores the old order (`claim` first, look up after) and runs only that spec.
 */
const FILE = "src/features/canvas/components/logo-canvas.tsx";
const original = readFileSync(FILE, "utf8");

const fixed = `		const pendingId = peekPendingDesignId(cwd);
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) return;
		claimedRef.current = pendingId;
		claimPendingDesignId(cwd);`;

const broken = `		const pendingId = claimPendingDesignId(cwd);
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) return;
		claimedRef.current = pendingId;`;

if (!original.includes(fixed)) throw new Error("fixed block not found");
writeFileSync(FILE, original.replace(fixed, broken));

const run = () => {
	try {
		execFileSync("bunx", ["vitest", "run", "src/test/panel-reveal.test.tsx"], { encoding: "utf8", stdio: "pipe" });
		return 0;
	} catch (error) {
		return error.status ?? 1;
	}
};

const red = run();
writeFileSync(FILE, original);
const green = run();
console.log(`mutated exit: ${red} · restored exit: ${green}`);
if (red === 0) throw new Error("the late-record test stayed green with the old order");
if (green !== 0) throw new Error("the test is red after restoring the fix");
console.log("late-record test is red-capable");
