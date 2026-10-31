import { describe, expect, it } from "vitest";

import { COMMUNITY_CREDENTIAL } from "../src/entitlement/default-credential.js";
import { decodeToken } from "../src/entitlement/credential-token.js";
import { EntitlementGate, GATED_TOOL_IDS, isGatedTool } from "../src/entitlement/entitlement-gate.js";
import { TRUSTED_KEYS } from "../src/entitlement/trusted-keys.js";
import { verifyEntitlement } from "../src/entitlement/verify-entitlement.js";
import { MemoryManuscriptStorage } from "../src/repository/manuscript-storage.js";

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");
const gateClock = () => FIXED_NOW;

function tamper(token: string): string {
	const [prefix, payload, signature] = token.split(".");
	const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	claims.subject = "somebody-else";
	const forged = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
	return [prefix, forged, signature].join(".");
}

describe("bundled community credential", () => {
	it("verifies against the shipped trusted key", () => {
		const state = verifyEntitlement(COMMUNITY_CREDENTIAL, { keys: TRUSTED_KEYS, now: FIXED_NOW });
		expect(state.status).toBe("active");
		if (state.status !== "active") return;
		expect(state.claims.entitlements).toContain("studio");
		expect(TRUSTED_KEYS.some((key) => key.keyId === state.claims.keyId)).toBe(true);
	});

	it("is not a plaintext payload — the token is signed, not just encoded", () => {
		const decoded = decodeToken(COMMUNITY_CREDENTIAL);
		expect(decoded).not.toBeNull();
		expect(decoded?.signature.length).toBe(64);
		expect(decoded?.signedText).toContain('"entitlements"');
	});

	it("rejects a payload edited after signing", () => {
		const state = verifyEntitlement(tamper(COMMUNITY_CREDENTIAL), { keys: TRUSTED_KEYS, now: FIXED_NOW });
		expect(state.status).toBe("invalid");
		if (state.status === "invalid") expect(state.reason).toBe("signature-mismatch");
	});

	it("rejects a token signed by a key this build does not trust", () => {
		const [prefix, payload, signature] = COMMUNITY_CREDENTIAL.split(".");
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		claims.keyId = "nw-untrusted";
		const fake = [prefix, Buffer.from(JSON.stringify(claims), "utf8").toString("base64url"), signature].join(".");
		const state = verifyEntitlement(fake, { keys: TRUSTED_KEYS, now: FIXED_NOW });
		expect(state.status).toBe("invalid");
		if (state.status === "invalid") expect(state.reason).toBe("unknown-key-id");
	});

	it("rejects a structurally broken token instead of throwing", () => {
		expect(verifyEntitlement("nw1.only-two-parts", { keys: TRUSTED_KEYS, now: FIXED_NOW }).status).toBe("invalid");
		expect(verifyEntitlement("", { keys: TRUSTED_KEYS, now: FIXED_NOW }).status).toBe("missing");
	});

	it("treats a wrongly typed claim as malformed instead of throwing", () => {
		// 手贴的凭证里 `entitlements` 写成数字时，规范化时的展开会抛。验签必须是全函数。
		const [prefix, payload, signature] = COMMUNITY_CREDENTIAL.split(".");
		const claims = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
		claims.entitlements = 5;
		const broken = [prefix, Buffer.from(JSON.stringify(claims), "utf8").toString("base64url"), signature].join(".");
		expect(() => verifyEntitlement(broken, { keys: TRUSTED_KEYS, now: FIXED_NOW })).not.toThrow();
		expect(verifyEntitlement(broken, { keys: TRUSTED_KEYS, now: FIXED_NOW }).status).toBe("invalid");
	});

	it("reports expiry as expired, not as a generic failure", () => {
		// 日期从凭证自己身上取：写死一个日期的话，下一次换发就必须回来改测试，
		// 而这类「记得改」，漏掉的代价是测试一直在替上一张凭证做保证。
		const claims = decodeToken(COMMUNITY_CREDENTIAL)?.claims;
		expect(claims).toBeDefined();
		const dayAfter = new Date(Date.parse(claims!.expiresAt) + 2 * 86_400_000);
		const state = verifyEntitlement(COMMUNITY_CREDENTIAL, { keys: TRUSTED_KEYS, now: dayAfter });
		expect(state.status).toBe("expired");
	});

	it("carries the studio's own name, not the pre-rename one", () => {
		// 激活页把 `subject` 原样当「签发主体」显示（ActivationPage 的 fact 表）。
		// 凭证里一旦带回旧产品名，界面上就会冒出一个本插件已不再使用的名字，
		// 而这不是 UI 能遮掉的——只能保证签发的 payload 里没有它。
		const claims = decodeToken(COMMUNITY_CREDENTIAL)?.claims;
		expect(claims?.subject.startsWith("mahua")).toBe(true);
		expect(COMMUNITY_CREDENTIAL.toLowerCase()).not.toContain("novelwright");
	});
});

describe("EntitlementGate", () => {
	it("falls back to the bundled credential when nothing was activated", async () => {
		const gate = new EntitlementGate(new MemoryManuscriptStorage(), gateClock);
		const state = await gate.load();
		expect(state.status).toBe("active");
		expect(gate.active).toBe(true);
	});

	it("keeps a working credential when a broken one is pasted", async () => {
		const storage = new MemoryManuscriptStorage();
		const gate = new EntitlementGate(storage, gateClock);
		await gate.load();
		const result = await gate.activate("nw1.bogus.bogus");
		expect(result.status).toBe("invalid");
		expect(gate.active).toBe(true);
		expect(await storage.list("entitlement")).toEqual([]);
	});

	it("persists a verified credential and survives a reload", async () => {
		const storage = new MemoryManuscriptStorage();
		const first = new EntitlementGate(storage, gateClock);
		await first.load();
		expect((await first.activate(COMMUNITY_CREDENTIAL)).status).toBe("active");

		const second = new EntitlementGate(storage, gateClock);
		expect((await second.load()).status).toBe("active");
	});

	it("records a rejected paste instead of pretending it worked", async () => {
		const gate = new EntitlementGate(new MemoryManuscriptStorage(), gateClock);
		await gate.load();
		await gate.activate("nw1.bogus.bogus");
		expect(gate.credentialSource).toBe("bundled");
		expect(gate.rejectedStored?.status).toBe("invalid");
	});

	it("reports a stored credential that was dropped, not just an active studio", async () => {
		const storage = new MemoryManuscriptStorage();
		await storage.commit([
			{ type: "write", path: "entitlement.json", data: JSON.stringify({ token: "nw1.bogus.bogus" }), encoding: "utf8" },
		]);
		const gate = new EntitlementGate(storage, gateClock);
		expect((await gate.load()).status).toBe("active");
		expect(gate.credentialSource).toBe("bundled");
		expect(gate.rejectedStored?.status).toBe("invalid");
	});

	it("lets the user drop their own credential and fall back to the bundled one", async () => {
		const storage = new MemoryManuscriptStorage();
		const gate = new EntitlementGate(storage, gateClock);
		await gate.load();
		await gate.activate(COMMUNITY_CREDENTIAL);
		expect(gate.credentialSource).toBe("stored");
		const next = await gate.clearStored();
		expect(next.status).toBe("active");
		expect(gate.credentialSource).toBe("bundled");
		expect(gate.rejectedStored).toBeNull();
		expect(await storage.list("entitlement")).toEqual([]);
	});

	it("exposes the accepted key ids for the activation page", () => {
		const gate = new EntitlementGate(new MemoryManuscriptStorage(), gateClock);
		expect(gate.trustedKeys().map((key) => key.keyId)).toEqual(TRUSTED_KEYS.map((key) => key.keyId));
	});
});

describe("gated tool surface", () => {
	const READ_TOOLS = [
		"mahua_list_books",
		"mahua_book_status",
		"mahua_next_instruction",
		"mahua_read_chapter",
	];

	it("gates every write and arbitration tool", () => {
		for (const id of [
			"mahua_create_book",
			"mahua_accept_brief",
			"mahua_save_plan",
			"mahua_save_outline",
			"mahua_start_drafting",
			"mahua_save_chapter",
			"mahua_save_review",
			"mahua_commit_chapter",
			"mahua_close_arc",
			"mahua_finalize",
			"mahua_arbitrate",
		]) {
			expect(isGatedTool(id), `${id} must be gated`).toBe(true);
		}
	});

	it("never gates a read tool", () => {
		for (const id of READ_TOOLS) expect(isGatedTool(id), `${id} must stay readable`).toBe(false);
	});

	it("has no duplicates", () => {
		expect(new Set(GATED_TOOL_IDS).size).toBe(GATED_TOOL_IDS.length);
	});
});
