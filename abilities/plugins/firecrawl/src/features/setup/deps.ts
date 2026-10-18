/**
 * Activation-time handles for the setup slot.
 *
 * `registerAbilityDetailSlot` only receives an ability identity, not the plugin
 * runtime, so the config instance is published here once during activation and
 * read back by the slot. Activation always runs before any ability page renders.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { FirecrawlConfig } from "../../runtime/config";

export interface SetupDeps {
	ctx: PluginContext;
	config: FirecrawlConfig;
}

let current: SetupDeps | null = null;

export function setSetupDeps(deps: SetupDeps): void {
	current = deps;
}

export function getSetupDeps(): SetupDeps | null {
	return current;
}
