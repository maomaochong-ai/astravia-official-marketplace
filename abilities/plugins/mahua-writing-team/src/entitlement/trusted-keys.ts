import type { TrustedKey } from "./verify-entitlement.js";

/**
 * 信任锚。只放**公钥**；签发私钥由发布负责人离线保管，永不入库（ADR 0004）。
 *
 * 轮换做法：新增一条 keyId 后旧条目保留到最后一个引用它的凭证过期，
 * 否则换钥当天所有用户一起掉授权。
 *
 * 0.4.23 的轮换（ADR 0033）：随包社区凭证改由 `mahua-2026-01` 签发，
 * 因为旧凭证的 `subject` 写的是插件改名前的主体名，激活页会把它当「签发主体」展示出来。
 * `nw-2026-01` **不删**：作者此前已经按 `scripts/issue-credential.mjs` 发过凭证，
 * 那些 token 在用户机器上，撤掉这把钥匙等于让它们一夜之间验签失败。
 */
export const TRUSTED_KEYS: readonly TrustedKey[] = [
	{
		keyId: "mahua-2026-01",
		publicKey: "GWOdQ1z48sKwhFcQXa6gP3fRcCrwRhlKkHgc1YjJXRo",
	},
	{
		keyId: "nw-2026-01",
		publicKey: "kAsdPcfKj-ptzZdT9QXUa1NGMptpdmMMvx17Zy6wbIU",
	},
];
