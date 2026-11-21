// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePluginText } from "@astravia-org/plugin-sdk";
import { CONTRIBUTION_LABEL_KEYS, catalogKey } from "../contributions";

/**
 * The composer pill and the tab label show a **variable name** when a `%key%`
 * does not resolve. That happens in exactly two ways, and both are checkable here
 * without a running host:
 *
 *  - the key is missing from the plugin's catalog → the resolver returns the bare
 *    key (`panel.title`);
 *  - the label is not written as `%key%` at all → it renders literally.
 *
 * `resolvePluginText` is the same function the host calls, so a green run here
 * means the pill cannot show `panel.title` for these contributions.
 */

const ROOT = process.cwd();
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")) as Record<string, string>,
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")) as Record<string, string>,
};
const plugin = JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8")) as {
	name: string;
	description: string;
	defaultLocale: string;
	agent: {
		skillPresentation: { skills: Record<string, { displayName: string }> };
		agents: { name: string; description?: string }[];
		teams: { name: string; description?: string; members: { responsibility: string }[] }[];
	};
};

describe("host-rendered labels", () => {
	const cases: { label: string; raw: string }[] = [
		{ label: "plugin name", raw: plugin.name },
		{ label: "plugin description", raw: plugin.description },
		...CONTRIBUTION_LABEL_KEYS.map((raw) => ({ label: raw, raw })),
		// The skill pill in the composer and the skill picker read this one.
		...Object.entries(plugin.agent.skillPresentation.skills).map(([id, entry]) => ({
			label: `skill[${id}].displayName`,
			raw: entry.displayName,
		})),
		// And every `%key%` anywhere in the manifest, so a new one cannot slip in
		// without a catalogue entry behind it.
		...[...readFileSync(join(ROOT, "plugin.json"), "utf8").matchAll(/%([a-zA-Z0-9_.]+)%/g)].map((match) => ({
			label: `manifest ${match[0]}`,
			raw: match[0],
		})),
		...plugin.agent.agents.flatMap((agent, index) => [
			{ label: `agent[${index}].name`, raw: agent.name },
			...(agent.description ? [{ label: `agent[${index}].description`, raw: agent.description }] : []),
		]),
		...(plugin.agent.teams ?? []).flatMap((team, index) => [
			{ label: `team[${index}].name`, raw: team.name },
			...(team.description ? [{ label: `team[${index}].description`, raw: team.description }] : []),
			...team.members.map((member, memberIndex) => ({
				label: `team[${index}].members[${memberIndex}].responsibility`,
				raw: member.responsibility,
			})),
		]),
	];

	it("collects every host-rendered string", () => {
		expect(cases.length).toBeGreaterThanOrEqual(10);
	});

	for (const locale of ["en", "zh"] as const) {
		it(`resolves each one in ${locale}, never to a bare key`, () => {
			const missing: string[] = [];
			for (const entry of cases) {
				// A label that is not `%key%` renders literally; it must at least be prose.
				expect(entry.raw.startsWith("%")).toBe(true);
				const resolved = resolvePluginText(entry.raw, locales, locale, plugin.defaultLocale);
				if (resolved === entry.raw || resolved === catalogKey(entry.raw)) missing.push(`${entry.label} (${entry.raw})`);
			}
			expect(missing, `unresolved in ${locale}: ${missing.join(", ")}`).toEqual([]);
		});
	}

	it("gives the tab and the input action a human name, not the slug", () => {
		const tab = resolvePluginText("%tab.label%", locales, "zh", plugin.defaultLocale);
		const pill = resolvePluginText("%panel.title%", locales, "zh", plugin.defaultLocale);
		// The zh override is what a Chinese host renders: Chinese prose, not a slug and
		// not the English product name.
		expect(tab).toBe("标志设计");
		expect(pill).toBe("标志设计");
		// The slug is never what a user should read.
		expect(tab).not.toBe("logocreator");
		expect(pill).not.toBe("logocreator");
	});

	it("keeps the English name ASCII so a fallback locale is still legible", () => {
		expect(resolvePluginText("%tab.label%", locales, "en", plugin.defaultLocale)).toBe("LogoCreator");
	});
});
