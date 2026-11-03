import type { CraftProgress } from "../../domain/agent-report.ts";
import type { KernelEngine } from "./kernel/engine.ts";

/**
 * The one link between a React tab and the agent tools.
 *
 * A module lives per plugin bundle, so a single slot is enough: the tools ask for
 * "the engine", the open tab publishes it, and closing the tab clears it. No frame,
 * no message channel, no polling loop — there is nothing left to leak.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

let current: KernelEngine | null = null;
const listeners = new Set<(progress: CraftProgress | null) => void>();

export function setCraftEngine(engine: KernelEngine | null): void {
	current = engine;
}

export function craftEngine(): KernelEngine | null {
	return current;
}

export async function waitForCraftEngine(timeoutMs = 6000, intervalMs = 60): Promise<KernelEngine | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (current) return current;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	return current;
}

export function publishCraftProgress(progress: CraftProgress | null): void {
	for (const listener of listeners) listener(progress);
}

export function subscribeCraftProgress(listener: (progress: CraftProgress | null) => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
