/**
 * 离线验签。全部 fail-closed：任何一步不确定都当作未授权（ADR 0004）。
 *
 * 不联网、不问服务器，因此它证明的是"凭证由我方私钥签发过"，不是"使用者就是购买者"。
 * 这句话也写进激活页文案，不做超出能力的承诺。
 */

import { ed25519 } from "@noble/curves/ed25519";
import {
	decodeToken,
	REQUIRED_ENTITLEMENT,
	type EntitlementClaims,
} from "./credential.js";

export interface TrustedKey {
	keyId: string;
	/** base64url 的 32 字节 Ed25519 公钥。 */
	publicKey: string;
}

export type EntitlementState =
	| { status: "active"; claims: EntitlementClaims }
	| { status: "missing" }
	| { status: "invalid"; reason: string }
	| { status: "expired"; claims: EntitlementClaims };

export interface VerifyOptions {
	now: Date;
	keys: readonly TrustedKey[];
	/** 时钟回拨容忍窗口：早于 now 这么多仍算有效，避免用户改时区就掉授权。 */
	skewMs?: number;
}

const DEFAULT_SKEW_MS = 24 * 60 * 60 * 1000;

function decodePublicKey(base64url: string): Uint8Array | null {
	try {
		const normalized = base64url.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
		const binary = atob(padded);
		if (binary.length !== 32) return null;
		const bytes = new Uint8Array(32);
		for (let index = 0; index < 32; index += 1) bytes[index] = binary.charCodeAt(index);
		return bytes;
	} catch {
		return null;
	}
}

export function verifyEntitlement(token: string | null, options: VerifyOptions): EntitlementState {
	if (!token || token.trim().length === 0) return { status: "missing" };

	const decoded = decodeToken(token);
	if (!decoded) return { status: "invalid", reason: "malformed-token" };

	const { claims, signedText, signature } = decoded;
	if (signature.length !== 64) return { status: "invalid", reason: "bad-signature-length" };

	const key = options.keys.find((candidate) => candidate.keyId === claims.keyId);
	if (!key) return { status: "invalid", reason: "unknown-key-id" };

	const publicKey = decodePublicKey(key.publicKey);
	if (!publicKey) return { status: "invalid", reason: "bad-public-key" };

	let signatureOk = false;
	try {
		signatureOk = ed25519.verify(signature, new TextEncoder().encode(signedText), publicKey);
	} catch {
		signatureOk = false;
	}
	if (!signatureOk) return { status: "invalid", reason: "signature-mismatch" };

	if (typeof claims.subject !== "string" || claims.subject.trim().length === 0) {
		return { status: "invalid", reason: "empty-subject" };
	}

	const expiresAt = Date.parse(claims.expiresAt);
	if (Number.isNaN(expiresAt)) return { status: "invalid", reason: "bad-expiry" };

	const skew = options.skewMs ?? DEFAULT_SKEW_MS;
	if (options.now.getTime() - skew > expiresAt) {
		return { status: "expired", claims };
	}

	if (!Array.isArray(claims.entitlements) || !claims.entitlements.includes(REQUIRED_ENTITLEMENT)) {
		return { status: "invalid", reason: "missing-entitlement" };
	}

	return { status: "active", claims };
}
