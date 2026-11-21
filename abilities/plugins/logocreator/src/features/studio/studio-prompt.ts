import type { LogoSpec } from "../../domain/spec";
import { resolvePalette } from "../../domain/color-plan";
import { renderLogo } from "../../domain/engine/compose";

/**
 * What the studio hands to the conversation.
 *
 * The input-bar toggle is only worth having if turning it on changes something.
 * Here it does: while it is on, the next prompt carries the brand currently open
 * in the studio, so "make the header match our logo" works without the user
 * re-typing a hex code. Nothing is read from the workspace and nothing is sent
 * until the toggle is on and a send happens.
 */

let engaged = false;
let current: LogoSpec | null = null;

export function setStudioEngaged(value: boolean): void {
	engaged = value;
}

export function isStudioEngaged(): boolean {
	return engaged;
}

/** Called by the panel whenever the form changes. */
export function publishStudioSpec(spec: LogoSpec): void {
	current = spec;
}

export function currentStudioSpec(): LogoSpec | null {
	return current;
}

export function studioInstructions(): string[] {
	if (!engaged || !current || !current.brandName.trim()) return [];
	const palette = resolvePalette(current);
	const subject = renderLogo(current).subject;
	return [
		[
			`The user is working on the "${current.brandName}" brand in the LogoCreator studio.`,
			`Current design: ${current.type}, ${current.style} style, ${current.detail} detail, mark "${subject}".`,
			`Brand colours: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}, ink ${palette.ink}.`,
			"When they ask for screens, slides or documents, use these colours and keep the mark's proportions.",
			"If they ask to change the logo itself, call logocreator_design instead of editing these values.",
		].join(" "),
	];
}
