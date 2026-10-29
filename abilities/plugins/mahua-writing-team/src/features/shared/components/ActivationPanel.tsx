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

const FACT_LABEL = "text-muted-foreground";

/**
 * 激活页。文案刻意写清能力边界：离线验签证明凭证由我方私钥签发，不证明使用者就是购买者。
 *
 * 第二件事是「说清现在用的是谁的凭证」（ADR 0024 §5）：回退到社区凭证不是无事件——
 * 用户填过的凭证过期或损坏时，这里要把原因摆在前面，否则他会以为自己的凭证已经生效。
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
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
			<div className="flex flex-col gap-1.5">
				<h1 className="text-base font-medium">{t("activation.title")}</h1>
				<p className="text-sm text-muted-foreground">{t("activation.body")}</p>
			</div>

			{source === "bundled" && rejectedReason ? (
				<div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
					<p className="font-medium">{t("activation.fallbackTitle")}</p>
					<p className="mt-1 text-muted-foreground">
						{t("activation.fallbackBody", { reason: rejectedReason })}
					</p>
				</div>
			) : null}

			{active ? (
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-2">
						<h2 className="text-sm font-medium">{t("activation.activeTitle")}</h2>
						<span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
							{source === "stored" ? t("activation.sourceStored") : t("activation.sourceBundled")}
						</span>
					</div>
					<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
						<dt className={FACT_LABEL}>{t("activation.fact.subject")}</dt>
						<dd className="break-all">{state.claims.subject}</dd>
						<dt className={FACT_LABEL}>{t("activation.fact.plan")}</dt>
						<dd>{state.claims.plan}</dd>
						<dt className={FACT_LABEL}>{t("activation.fact.entitlements")}</dt>
						<dd className="break-all">{state.claims.entitlements.join(" · ")}</dd>
						<dt className={FACT_LABEL}>{t("activation.fact.expiresAt")}</dt>
						<dd className="tabular-nums">{state.claims.expiresAt.slice(0, 10)}</dd>
						<dt className={FACT_LABEL}>{t("activation.fact.keyId")}</dt>
						<dd>{state.claims.keyId}</dd>
					</dl>
					<p className="text-xs leading-relaxed text-muted-foreground">{t("activation.activeBody")}</p>
				</div>
			) : null}

			{reason ? (
				<p className="rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">{reason}</p>
			) : null}

			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium text-muted-foreground">{t("activation.tokenLabel")}</span>
				<textarea
					value={token}
					onChange={(event) => setToken(event.target.value)}
					placeholder={t("activation.placeholder")}
					rows={4}
					className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={submit}
					disabled={busy || token.trim().length === 0}
					className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
				>
					{t("activation.submit")}
				</button>
				{source === "stored" ? (
					<button
						type="button"
						onClick={clear}
						disabled={busy}
						className="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
					>
						{t("activation.clear")}
					</button>
				) : null}
				<span className="text-xs text-muted-foreground">
					{t("activation.keyIds", { keys: keyIds.join(", ") })}
				</span>
			</div>

			<p className="text-xs leading-relaxed text-muted-foreground">{t("activation.honest")}</p>
		</div>
	);
}
