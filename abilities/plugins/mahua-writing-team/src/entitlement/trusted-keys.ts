import type { TrustedKey } from "./verify-entitlement.js";

/**
 * 信任锚。只放**公钥**；签发私钥由发布负责人离线保管，永不入库（ADR 0004）。
 *
 * 轮换做法：新增一条 keyId（如 `nw-2027-01`）后旧条目保留到最后一个引用它的凭证过期，
 * 否则换钥当天所有用户一起掉授权。
 */
export const TRUSTED_KEYS: readonly TrustedKey[] = [
	{
		keyId: "nw-2026-01",
		publicKey: "kAsdPcfKj-ptzZdT9QXUa1NGMptpdmMMvx17Zy6wbIU",
	},
];

