import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { CredentialSource } from "../../../entitlement/entitlement-gate.js";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";

interface ActivationPanelProps {
	entitlement: EntitlementState;
	keyIds: readonly string[];
	/** 自己那份凭证被拒时的验签结果；为 null 表示没填过或验签通过。 */
	rejected: EntitlementState | null;
	/** 当前生效凭证的来源。`bundled` + `rejected` 非空 = 用户那份没用上。 */
	source: CredentialSource;
	onActivate(token: string): Promise<EntitlementState>;
	onClear(): Promise<EntitlementState>;
}

const REASON_KEY: Record<string, string> = {
	"malformed-token": "activation.reason.malformed",
	"bad-signature-length": "activation.reason.malformed",
	"unknown-key-id": "activation.reason.unknownKey",
	"bad-public-key": "activation.reason.unknownKey",
	"signature-mismatch": "activation.reason.signature",
	"empty-subject": "activation.reason.malformed",
	"bad-expiry": "activation.reason.malformed",
	"missing-entitlement": "activation.reason.entitlement",
};

/** 设计稿里「它只说这三句」的三行：我们确实只会因这三类原因拒绝一份凭证。 */
const FAILURES = [
	{ code: "expired", key: "activation.reason.expired" },
	{ code: "signature-mismatch", key: "activation.reason.signature" },
	{ code: "unknown-key-id", key: "activation.reason.unknownKey" },
] as const;

const RULES = ["activation.rule.offline", "activation.rule.machine", "activation.rule.expiry"] as const;

const FACT_LABEL = "font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70";
const PRIMARY =
	"flex h-8 items-center gap-1.5 rounded-[9px] bg-foreground px-3.5 text-[11px] font-medium text-background transition-opacity disabled:opacity-40";
const SECONDARY =
	"flex h-8 items-center gap-1.5 rounded-[9px] border border-border px-3 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40";

/** 到期还剩几天：设计稿那一栏写的是「2027-05-31 · 还剩 213 天」，日期之后要有个人话的余量。 */
function daysUntil(iso: string): number {
	const at = Date.parse(iso);
	if (Number.isNaN(at)) return 0;
	return Math.max(0, Math.ceil((at - Date.now()) / 86_400_000));
}

/**
 * 激活页。文案刻意写清能力边界：离线验签证明凭证由我方私钥签发，不证明使用者就是购买者。
 *
 * 第二件事是「说清现在用的是谁的凭证」（ADR 0024 §5）：回退到社区凭证不是无事件——
 * 用户填过的凭证过期或损坏时，这里要把原因摆在前面，否则他会以为自己的凭证已经生效。
 *
 * 版面照设计稿的激活帧：左牌（品牌、三条规矩、一句引语）+ 右表单，左牌只在 `lg` 出现——
 * 标签页最窄 400px 时留给凭证输入框，不给品牌位。设计帧的 420px 左栏按容器收成 300px。
 */
export function ActivationPanel({
	entitlement,
	keyIds,
	rejected,
	source,
	onActivate,
	onClear,
}: ActivationPanelProps) {
	const { t } = useTranslation();
	const [token, setToken] = useState("");
	const [state, setState] = useState<EntitlementState>(entitlement);
	const [busy, setBusy] = useState(false);

	const describe = (target: EntitlementState): string | null => {
		if (target.status === "expired") return t("activation.expired", { at: target.claims.expiresAt });
		if (target.status === "invalid") {
			return t(REASON_KEY[target.reason] ?? "activation.reason.malformed");
		}
		return null;
	};

	const submit = async () => {
		if (!token.trim() || busy) return;
		setBusy(true);
		try {
			setState(await onActivate(token.trim()));
		} finally {
			setBusy(false);
		}
	};

	const clear = async () => {
		if (busy) return;
		setBusy(true);
		try {
			setState(await onClear());
		} finally {
			setBusy(false);
		}
	};

	const reason = describe(state);
	const rejectedReason = rejected ? describe(rejected) : null;
	const active = state.status === "active";

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row">
			<aside className="hidden w-[300px] shrink-0 flex-col justify-between rounded-[18px] bg-muted px-7 py-7 lg:flex">
				<div>
					<div className="flex size-11 items-center justify-center rounded-[6px] bg-primary font-serif text-[20px] leading-none text-primary-foreground">
						{t("activation.mark")}
					</div>
					<h1 className="mt-5 font-serif text-[22px] font-semibold leading-tight tracking-tight text-foreground">
						{t("view.studio.label")}
					</h1>
					<p className="mt-1 text-[11px] text-muted-foreground">{t("activation.brandLine")}</p>

					<div className="mt-7 flex flex-col gap-2.5">
						{RULES.map((key) => (
							<div key={key} className="flex items-start gap-2.5">
								<span className="mt-0.5 icon-[solar--shield-check-linear] size-3.5 shrink-0 text-primary" />
								<span className="text-[10px] leading-4 text-foreground/75">{t(key)}</span>
							</div>
						))}
					</div>
				</div>

				<div className="border-t border-border pt-5">
					<p className="font-serif text-[13px] leading-6 text-foreground/85">{t("activation.quote")}</p>
					<p className="mt-2 text-[10px] leading-4 text-muted-foreground/70">{t("activation.quoteNote")}</p>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-1 py-1">
					<div>
						<h2 className="font-serif text-[19px] font-semibold leading-tight tracking-tight text-foreground">
							{t("activation.title")}
						</h2>
						<p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{t("activation.body")}</p>
					</div>

					{source === "bundled" && rejectedReason ? (
						<div className="rounded-[13px] border border-border bg-muted/60 px-3 py-2.5">
							<p className="text-[11px] font-semibold text-foreground">{t("activation.fallbackTitle")}</p>
							<p className="mt-1 text-[11px] leading-4 text-muted-foreground">
								{t("activation.fallbackBody", { reason: rejectedReason })}
							</p>
						</div>
					) : null}

					{active ? (
						<div className="flex flex-col gap-2.5">
							<div className="flex items-baseline justify-between gap-2">
								<span className="font-serif text-[15px] font-semibold text-foreground">
									{t("activation.activeTitle")}
								</span>
								<span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
									{source === "stored" ? t("activation.sourceStored") : t("activation.sourceBundled")}
								</span>
							</div>

							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<div>
									<div className={FACT_LABEL}>{t("activation.fact.keyId")}</div>
									<div className="mt-1 flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-card px-2.5 font-mono text-[11px] text-muted-foreground">
										{state.claims.keyId}
										<span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
											<span className="icon-[solar--shield-check-linear] size-3" />
											{t("activation.factsLocal")}
										</span>
									</div>
								</div>
								<div>
									<div className={FACT_LABEL}>{t("activation.fact.expiresAt")}</div>
									<div className="mt-1 flex h-8 items-center rounded-[9px] border border-border bg-card px-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
										{state.claims.expiresAt.slice(0, 10)} ·{" "}
										{t("activation.daysLeft", { days: daysUntil(state.claims.expiresAt) })}
									</div>
								</div>
							</div>

							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
								<dt className="text-muted-foreground">{t("activation.fact.subject")}</dt>
								<dd className="break-all text-foreground">{state.claims.subject}</dd>
								<dt className="text-muted-foreground">{t("activation.fact.plan")}</dt>
								<dd className="text-foreground">{state.claims.plan}</dd>
								<dt className="text-muted-foreground">{t("activation.fact.entitlements")}</dt>
								<dd className="break-all text-foreground">{state.claims.entitlements.join(" · ")}</dd>
							</dl>
							<p className="text-[11px] leading-4 text-muted-foreground">{t("activation.activeBody")}</p>
						</div>
					) : null}

					{reason ? (
						<p className="rounded-[9px] bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
							{reason}
						</p>
					) : null}

					<div>
						<div className="flex items-baseline justify-between">
							<span className={FACT_LABEL}>{t("activation.tokenLabel")}</span>
							<span className="font-mono text-[10px] text-muted-foreground/70">
								{t("activation.placeholder")}
							</span>
						</div>
						<textarea
							value={token}
							onChange={(event) => setToken(event.target.value)}
							placeholder={t("activation.placeholder")}
							rows={4}
							className="mt-1.5 w-full resize-none rounded-[13px] border border-border bg-muted/50 px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={submit}
							disabled={busy || token.trim().length === 0}
							className={PRIMARY}
						>
							<span className="icon-[solar--key-minimalistic-linear] size-3.5" />
							{t("activation.submit")}
						</button>
						{source === "stored" ? (
							<button type="button" onClick={clear} disabled={busy} className={SECONDARY}>
								<span className="icon-[solar--trash-bin-minimalistic-linear] size-3.5" />
								{t("activation.clear")}
							</button>
						) : null}
						<span className="font-mono text-[10px] text-muted-foreground/70">
							{t("activation.keyIds", { keys: keyIds.join(", ") })}
						</span>
					</div>

					<div className="border-t border-border pt-3">
						<div className="flex items-baseline justify-between gap-2">
							<h3 className="text-[10px] font-semibold tracking-[0.08em] text-foreground">
								{t("activation.failureTitle")}
							</h3>
							<span className="text-[10px] text-muted-foreground/70">{t("activation.failureNote")}</span>
						</div>
						<ul className="mt-2 flex flex-col gap-1.5">
							{FAILURES.map((item) => (
								<li
									key={item.code}
									className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-2.5 py-1.5"
								>
									<span className="font-mono text-[10px] text-destructive">{item.code}</span>
									<span className="text-[10px] text-muted-foreground">{t(item.key)}</span>
								</li>
							))}
						</ul>
					</div>

					<p className="text-[10px] leading-4 text-muted-foreground/70">{t("activation.footnote")}</p>
				</div>

				<div className="mt-auto flex items-center gap-1.5 px-1 pt-3 text-[10px] text-muted-foreground/70">
					<span className="icon-[solar--info-circle-linear] size-3 shrink-0" />
					{t("activation.offlineNote")}
				</div>
			</div>
		</div>
	);
}
