// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Artwork contract.
 *
 * The catalogue card icon and the agent avatar are the *same* mark rendered twice;
 * if they drift, one surface shows a caterpillar and another shows last week's
 * logo. These checks pin the things the host actually enforces
 * (`plugin-agent-presets.ts`: extension whitelist + 512 KB ceiling per avatar;
 * marketplace: ≤ 8 MB per image) plus the square shape the round avatar slot
 * expects.
 */

const ROOT = process.cwd();
const plugin = JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8")) as {
	icon: string;
	agent: { agents: { avatar?: string }[] };
};
const ability = JSON.parse(readFileSync(join(ROOT, "ability.json"), "utf8")) as { icon?: string };

const HOST_AVATAR_EXTENSIONS = /\.(webp|png|jpe?g|gif|svg)$/i;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_AVATAR_BYTES = 512 * 1024;

interface Info {
	format: "png" | "webp";
	width?: number;
	height?: number;
}

function imageInfo(bytes: Buffer): Info | null {
	if ([...bytes.subarray(0, 8)].join(",") === "137,80,78,71,13,10,26,10") {
		return { format: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	}
	if (bytes.subarray(0, 4).toString("latin1") !== "RIFF" || bytes.subarray(8, 12).toString("latin1") !== "WEBP") return null;
	const kind = bytes.subarray(12, 16).toString("latin1");
	if (kind === "VP8X") {
		return {
			format: "webp",
			width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
			height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
		};
	}
	if (kind === "VP8 ") {
		return { format: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
	}
	if (kind === "VP8L") {
		return {
			format: "webp",
			width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
			height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
		};
	}
	return { format: "webp" };
}

describe("artwork", () => {
	it("uses the same file for the card icon and the ability icon", () => {
		expect(ability.icon).toBe(plugin.icon);
		expect(plugin.icon).toBe("assets/icon.png");
	});

	it("ships a square plugin icon big enough for a retina card", () => {
		const bytes = readFileSync(join(ROOT, plugin.icon));
		expect(bytes.byteLength).toBeLessThan(MAX_ASSET_BYTES);
		const info = imageInfo(bytes);
		expect(info?.format).toBe("png");
		expect(info?.width).toBe(info?.height);
		expect(info?.width).toBeGreaterThanOrEqual(512);
	});

	it("ships the agent avatar in a host-accepted format under the ceiling", () => {
		const avatar = plugin.agent.agents[0]?.avatar;
		expect(avatar).toBeTruthy();
		expect(avatar).toMatch(HOST_AVATAR_EXTENSIONS);
		expect(avatar).toMatch(/^agent\/agents\//);
		const bytes = readFileSync(join(ROOT, avatar!));
		expect(bytes.byteLength).toBeLessThan(MAX_AVATAR_BYTES);
		const info = imageInfo(bytes);
		expect(info?.format).toBe("webp");
		expect(info?.width).toBe(info?.height);
		expect(info?.width).toBeGreaterThanOrEqual(128);
	});

	it("keeps no second icon around", () => {
		// One mark or none: a leftover svg/png beside it wins on whichever surface
		// falls back to a directory scan, and then the plugin looks inconsistent.
		expect(plugin.icon).toBe("assets/icon.png");
		expect(readdirSync(join(ROOT, "assets"))).toEqual(["icon.png"]);
	});
});
