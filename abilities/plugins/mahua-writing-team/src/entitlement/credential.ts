/**
 * 离线凭证的载荷与编码（ADR 0004）。
 *
 * 令牌形态：`nw1.<base64url(claims JSON)>.<base64url(Ed25519 detached sig)>`。
 * 签名覆盖**规范化后的 claims 文本**——键按字典序、无空白，保证同一份凭证在任何
 * 实现里算出的字节都一致；直接签原文会让"加个空格"变成验签失败。
 */

export const TOKEN_PREFIX = "nw1";
export const REQUIRED_ENTITLEMENT = "studio";

export type EntitlementPlan = "community" | "studio-pro";

export interface EntitlementClaims {
	/** claims 结构版本。加字段不升，改语义才升。 */
	v: 1;
	/** 被授权主体（购买者标识）。只用于展示与审计，不为它做身份绑定。 */
	subject: string;
	plan: EntitlementPlan;
	/** 权益列表，必须包含 `studio` 才解锁工作台。 */
	entitlements: string[];
	issuedAt: string;
	expiresAt: string;
	keyId: string;
}

export interface DecodedToken {
	claims: EntitlementClaims;
	/** 被签名的规范化文本。验签必须用这一份，而不是重新序列化。 */
	signedText: string;
	signature: Uint8Array;
}

export function canonicalClaims(claims: EntitlementClaims): string {
	const ordered: Record<string, unknown> = {
		entitlements: [...claims.entitlements].sort(),
		expiresAt: claims.expiresAt,
		issuedAt: claims.issuedAt,
		keyId: claims.keyId,
		plan: claims.plan,
		subject: claims.subject,
		v: claims.v,
	};
	return JSON.stringify(ordered);
}

export function decodeBase64Url(text: string): Uint8Array | null {
	try {
		const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
		return bytes;
	} catch {
		return null;
	}
}

export function decodeToken(token: string): DecodedToken | null {
	const parts = token.trim().split(".");
	if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
	const payloadBytes = decodeBase64Url(parts[1]);
	const signature = decodeBase64Url(parts[2]);
	if (!payloadBytes || !signature) return null;

	let claims: EntitlementClaims;
	try {
		claims = JSON.parse(new TextDecoder().decode(payloadBytes)) as EntitlementClaims;
	} catch {
		return null;
	}
	// 规范化会展开 `entitlements`、重排字段；形状不对就必须在这里退回去，绝不能抛。
	// 抛出会越过 `verifyEntitlement`（它没有 try）一直传到 `EntitlementGate.load()`，
	// 把"填错一张凭证"变成"整个插件启动失败"。
	if (!isClaimsShape(claims)) return null;

	return { claims, signedText: canonicalClaims(claims), signature };
}

function isClaimsShape(value: unknown): value is EntitlementClaims {
	if (!value || typeof value !== "object") return false;
	const claims = value as Record<string, unknown>;
	return (
		claims.v === 1 &&
		typeof claims.subject === "string" &&
		typeof claims.plan === "string" &&
		typeof claims.issuedAt === "string" &&
		typeof claims.expiresAt === "string" &&
		typeof claims.keyId === "string" &&
		Array.isArray(claims.entitlements) &&
		claims.entitlements.every((item) => typeof item === "string")
	);
}
