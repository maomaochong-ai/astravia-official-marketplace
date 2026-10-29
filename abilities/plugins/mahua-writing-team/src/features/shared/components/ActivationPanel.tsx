import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";

interface ActivationPanelProps {
	entitlement: EntitlementState;
	keyIds: readonly string[];
	onActivate(token: string): Promise<EntitlementState>;
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

/**
 * 激活页。文案刻意写清能力边界：离线验签证明凭证由我方私钥签发，不证明使用者就是购买者。
 */
export function ActivationPanel({ entitlement, keyIds, onActivate }: ActivationPanelProps) {
	const { t } = useTranslation();
	const [token, setToken] = useState("");
	const [state, setState] = useState<EntitlementState>(entitlement);
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (!token.trim() || busy) return;
		setBusy(true);
		try {
			setState(await onActivate(token.trim()));
		} finally {
			setBusy(false);
		}
	};

	const reason =
		state.status === "invalid" ? t(REASON_KEY[state.reason] ?? "activation.reason.malformed") : null;

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
			<div className="flex flex-col gap-1.5">
				<h1 className="text-base font-medium">{t("activation.title")}</h1>
				<p className="text-sm text-muted-foreground">{t("activation.body")}</p>
			</div>

			{state.status === "expired" ? (
				<p className="rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">
					{t("activation.expired", { at: state.claims.expiresAt })}
				</p>
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

			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={submit}
					disabled={busy || token.trim().length === 0}
					className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
				>
					{t("activation.submit")}
				</button>
				<span className="text-xs text-muted-foreground">
					{t("activation.keyIds", { keys: keyIds.join(", ") })}
				</span>
			</div>

			<p className="text-xs leading-relaxed text-muted-foreground">{t("activation.honest")}</p>
		</div>
	);
}
