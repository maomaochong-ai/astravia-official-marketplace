import { resolvePalette } from "../../domain/color-plan";
import { renderLogo } from "../../domain/engine/compose";
import type { LogoSpec } from "../../domain/spec";
import { scopeKey } from "../../shared/lib/scope-key";

/**
 * What the composer chip carries into the next prompt — per conversation.
 *
 * The host keeps the toggle itself per session, so the chip being *on* in one
 * conversation says nothing about another. But this module used to hold a single
 * `engaged` flag and a single spec, which meant session B's brand colours could be
 * injected into session A's prompt: the chip was off in A, yet the decoration still
 * fired because the host asks whichever action is active in the *sending* session.
 *
 * Two things now make that impossible:
 *  - state is keyed by scope, and `decoratePrompt` reads the **active** scope, which
 *    `activate()` keeps current from `conversation-changed` events;
 *  - a scope only decorates while its own toggle is engaged.
 */

interface ScopeState {
	engaged: boolean;
	spec: LogoSpec | null;
}

const scopes = new Map<string, ScopeState>();

/** The conversation the host is currently showing; refreshed on session switches. */
let activeScope = scopeKey(null);

function stateFor(scope: string): ScopeState {
	let state = scopes.get(scope);
	if (!state) {
		state = { engaged: false, spec: null };
		scopes.set(scope, state);
	}
	return state;
}

/** Called from `conversation-changed` so `decoratePrompt` (sync) knows the target. */
export function setActiveConversation(cwd: string | null | undefined): void {
	activeScope = scopeKey(cwd);
}

export function activeScopeKey(): string {
	return activeScope;
}

/** The composer toggle flipped, in one conversation. */
export function setCanvasEngaged(cwd: string | null | undefined, engaged: boolean): void {
	stateFor(scopeKey(cwd)).engaged = engaged;
}

/** Called by the panel whenever its form changes. */
export function publishCanvasSpec(cwd: string | null | undefined, spec: LogoSpec): void {
	stateFor(scopeKey(cwd)).spec = spec;
}

/** Read side of the toggle state; used by the isolation test to prove scoping. */
export function isCanvasEngaged(cwd: string | null | undefined): boolean {
	return stateFor(scopeKey(cwd)).engaged;
}

export function canvasInstructions(): string[] {
	const state = scopes.get(activeScope);
	if (!state?.engaged || !state.spec || !state.spec.brandName.trim()) return [];
	const spec = state.spec;
	const palette = resolvePalette(spec);
	const subject = renderLogo(spec).subject;
	return [
		[
			`The user is working on the "${spec.brandName}" brand in the LogoCreator canvas.`,
			`Current design: ${spec.type}, ${spec.style} style, ${spec.detail} detail, mark "${subject}".`,
			`Brand colours: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}, ink ${palette.ink}.`,
			"When they ask for screens, slides or documents, use these colours and keep the mark's proportions.",
			"If they ask to change the logo itself, call logocreator_design instead of editing these values.",
		].join(" "),
	];
}

/** Test seam. */
export function clearCanvasPromptState(): void {
	scopes.clear();
	activeScope = scopeKey(null);
}
