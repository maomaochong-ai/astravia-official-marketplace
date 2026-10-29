/**
 * 特权门禁：一处判定，多处引用（ADR 0004 / 0007）。
 *
 * 状态来源优先级：用户自行激活的凭证 > 随包社区凭证。两个都验签失败才是未授权，
 * 并且失败原因是结构化的（`invalid`/`expired`），激活页据此给不同的提示。
 */

import { COMMUNITY_CREDENTIAL } from "./default-credential.js";
import { TRUSTED_KEYS } from "./trusted-keys.js";
import { verifyEntitlement, type EntitlementState, type TrustedKey } from "./verify-entitlement.js";
import type { ManuscriptStorage } from "../repository/manuscript-storage.js";

export const ENTITLEMENT_PATH = "entitlement.json";

/**
 * 写类与裁定类工具。新增者有测试盯着（test/entitlement.test.ts 断言「每个写工具都在这里」），
 * 但真正执行门禁的是 StudioService.requireEntitlement —— 这份名单是声明，不是执行点。
 */
export const GATED_TOOL_IDS: readonly string[] = [
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
	// 与 ainovel-cli 对齐后新增的写工具（ADR 0009）。读工具一律不进这张表。
	"mahua_save_foundation",
	"mahua_set_user_rules",
	"mahua_plan_chapter",
	"mahua_edit_chapter",
	"mahua_expand_next_arc",
	"mahua_save_arc_summary",
	"mahua_save_volume_summary",
	"mahua_flag_outline_feedback",
	"mahua_resolve_outline_feedback",
	"mahua_reopen_book",
	// 第二轮对齐（ADR 0015）：尾段重写章纲是写操作，必须进门禁；前提解析是读，不进来。
	"mahua_revise_outline",
	// ADR 0021：台账的两条写入口。体检是读，放在上面那张不进来的名单里。
	"mahua_flag_thread",
	"mahua_close_thread",
];

export function isGatedTool(toolId: string): boolean {
	return GATED_TOOL_IDS.includes(toolId);
}

export class EntitlementGate {
	private state: EntitlementState = { status: "missing" };

	constructor(
		private readonly storage: ManuscriptStorage,
		private readonly now: () => Date,
	) {}

	get current(): EntitlementState {
		return this.state;
	}

	get active(): boolean {
		return this.state.status === "active";
	}

	/**
	 * 读状态：用户凭证优先，其次随包社区凭证。
	 *
	 * 注意这条顺序的后果——新装即 `active`，因为社区凭证本身验签通过。这是刻意的
	 * （开箱能写），代价是"未授权"这条路只有凭证损坏或过期时才出现。ADR 0004 记录了
	 * 这个取舍：它是本插件自己的礼貌性门禁，不是付费墙。
	 */
	async load(): Promise<EntitlementState> {
		const stored = await this.readStoredToken();
		const fromStorage = stored ? this.verify(stored) : null;
		if (fromStorage?.status === "active") {
			this.state = fromStorage;
			return this.state;
		}

		const bundled = this.verify(COMMUNITY_CREDENTIAL);
		this.state = bundled;
		return this.state;
	}

	async activate(token: string): Promise<EntitlementState> {
		const next = this.verify(token);
		if (next.status !== "active") {
			// 失败不落盘：用户填错的凭证不该覆盖掉手上仍然有效的那一份。
			return next;
		}
		await this.storage.commit([
			{ type: "write", path: ENTITLEMENT_PATH, data: JSON.stringify({ token: token.trim() }), encoding: "utf8" },
		]);
		this.state = next;
		return next;
	}

	/** 激活页要展示当前信任锚的 keyId，方便认出「凭证不是给这个版本签的」。 */
	trustedKeys(): readonly TrustedKey[] {
		return TRUSTED_KEYS;
	}

	private verify(token: string): EntitlementState {
		return verifyEntitlement(token, { now: this.now(), keys: TRUSTED_KEYS });
	}

	private async readStoredToken(): Promise<string | null> {
		const raw = await this.storage.readFile(ENTITLEMENT_PATH, "utf8");
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as { token?: unknown };
			return typeof parsed.token === "string" ? parsed.token : null;
		} catch {
			return null;
		}
	}
}
