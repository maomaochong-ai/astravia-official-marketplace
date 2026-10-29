#!/usr/bin/env node
/**
 * 签发离线凭证（ADR 0004）。
 *
 * 私钥只在本地环境变量里，不落盘、不入库：
 *   NW_SIGNING_KEY=<64 位 hex>  NW_KEY_ID=nw-2026-01 \
 *   node scripts/issue-credential.mjs --subject alice --plan studio-pro --days 365
 *
 * 输出一行 token：`nw1.<payload>.<sig>`。把它交给用户粘贴到激活页即可。
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { randomBytes } from "node:crypto";

function fail(message) {
	console.error(`issue-credential: ${message}`);
	process.exit(1);
}

const args = process.argv.slice(2);
function arg(name, fallback) {
	const index = args.indexOf(`--${name}`);
	return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const subject = arg("subject");
const plan = arg("plan", "studio-pro");
const days = Number(arg("days", "365"));
const entitlements = arg("entitlements", "studio,export").split(",").map((item) => item.trim()).filter(Boolean);

if (!subject) fail("--subject is required");
if (!["community", "studio-pro"].includes(plan)) fail(`unknown plan: ${plan}`);
if (!Number.isFinite(days) || days <= 0) fail("--days must be a positive number");

const keyId = process.env.NW_KEY_ID;
const keyHex = process.env.NW_SIGNING_KEY;
if (!keyHex) fail("NW_SIGNING_KEY is not set");
if (!keyId) fail("NW_KEY_ID is not set");

const privateKey = Uint8Array.from(Buffer.from(keyHex, "hex"));
if (privateKey.length !== 32) fail("NW_SIGNING_KEY must be 32 bytes of hex (64 chars)");

const now = new Date();
const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const claims = {
	v: 1,
	subject,
	plan,
	entitlements,
	issuedAt: now.toISOString(),
	expiresAt,
	keyId,
};

const canonical = JSON.stringify({
	entitlements: [...claims.entitlements].sort(),
	expiresAt: claims.expiresAt,
	issuedAt: claims.issuedAt,
	keyId: claims.keyId,
	plan: claims.plan,
	subject: claims.subject,
	v: claims.v,
});

const signature = ed25519.sign(new TextEncoder().encode(canonical), privateKey);
const b64url = (bytes) =>
	Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const token = `nw1.${b64url(Buffer.from(canonical, "utf8"))}.${b64url(signature)}`;
console.log(token);
console.error(`issued for ${subject} (${plan}), expires ${expiresAt}, key ${keyId}`);

if (args.includes("--new-key")) {
	console.error(`new private key (store offline): ${Buffer.from(randomBytes(32)).toString("hex")}`);
}
