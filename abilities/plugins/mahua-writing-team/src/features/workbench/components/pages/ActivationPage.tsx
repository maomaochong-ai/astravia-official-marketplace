import { useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { coverSeed } from "../../workbench-model";
import { Cover } from "../shell/Cover";

/** 八个拒绝码，与 `verifyEntitlement` 的 `reason` 一一对应。`expired` 单独成一个状态。 */
const REJECTS = [
	"malformed-token",
	"bad-signature-length",
	"unknown-key-id",
	"bad-public-key",
	"signature-mismatch",
	"empty-subject",
	"bad-expiry",
	"missing-entitlement",
] as const;

const DAY_MS = 86_400_000;

/**
 * 激活页：离线验签的现场。
 *
 * 页面上每个数字都是验签当场算出来的：签发主体、权益清单、到期时间、还剩几天、凭证从哪来的。
 * 这里没有「机器指纹」——凭证里就没有这个字段，写上去是假的。验签失败时显示的是真实拒绝码，
 * 不是「网络异常」。
 */
export function ActivationPage({ data }: { data: StudioState }) {
	const t = useTranslator();
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const now = Date.now();
	const state = data.entitlement;
	const active = state.status === "active";
	const claims = state.status === "active" || state.status === "expired" ? state.claims : null;
	const days = claims ? Math.ceil((Date.parse(claims.expiresAt) - now) / DAY_MS) : 0;

	const run = async (action: () => Promise<unknown>) => {
		setBusy(true);
		try {
			await action();
		} finally {
			setBusy(false);
		}
	};

	const paste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text.trim().length > 0) setDraft(text.trim());
		} catch {
			// 读剪贴板可能被拒；此时不提示，用户仍可手动粘贴。
		}
	};

	return (
		<div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-8 py-8">
			<div className="flex w-full max-w-[880px] overflow-hidden rounded-sheet bg-raised shadow-raise">
				<aside className="flex w-[300px] shrink-0 flex-col justify-between bg-inset p-6">
					<div>
						<div className="flex items-center gap-2">
							<Cover {...coverSeed(t("activation.brand"))} size="thumb" />
							<span className="font-display text-body font-semibold text-ink">{t("activation.brand")}</span>
						</div>
						<p className="mt-4 font-display text-heading leading-8 text-ink">{t("activation.brandLine")}</p>
						<ul className="mt-4 space-y-2">
							{["offline", "keys", "noAccount"].map((key) => (
								<li key={key} className="flex gap-2 text-[11px] leading-5 text-ink-soft">
									<span className="icon-[lucide--check] mt-0.5 size-3 shrink-0 text-pass" />
									<span>{t(`activation.point.${key}`)}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="mt-6 border-t border-line pt-3">
						<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
							{t("activation.signingKeys")}
						</div>
						<ul className="mt-1.5 space-y-1">
							{data.trustedKeys().map((key) => (
								<li key={key.keyId} className="flex items-baseline gap-2 font-mono text-[10px] text-ink-soft">
									<span className="text-ink">{key.keyId}</span>
									<span className="min-w-0 flex-1 truncate">{key.publicKey}</span>
								</li>
							))}
						</ul>
						<p className="mt-2 text-[9.5px] leading-4 text-ink-faint">{t("activation.keysNote")}</p>
					</div>
				</aside>

				<div className="flex min-w-0 flex-1 flex-col p-6">
					<div className="flex items-center gap-2">
						<span
							className={`flex h-6 items-center gap-1.5 rounded-pill px-2 text-[10px] font-medium ${
								active ? "bg-pass-soft text-pass" : "bg-wait-soft text-wait"
							}`}
						>
							<span className={`size-1.5 rounded-pill ${active ? "bg-pass" : "bg-wait"}`} />
							{t(`activation.status.${state.status}`)}
						</span>
						<span className="text-[10px] text-ink-faint">
							{t(`activation.source.${data.credentialSource}`)}
						</span>
						{claims && (
							<span className="ml-auto font-mono text-[10px] text-ink-faint">
								{t("activation.fact.keyId", { keyId: claims.keyId })}
							</span>
						)}
					</div>

					{claims ? (
						<dl className="mt-4 grid grid-cols-[72px_1fr] gap-y-1.5 rounded-panel bg-inset/60 p-3 text-[11px]">
							<dt className="text-ink-faint">{t("activation.fact.subject")}</dt>
							<dd className="truncate text-ink">{claims.subject}</dd>
							<dt className="text-ink-faint">{t("activation.fact.plan")}</dt>
							<dd className="text-ink">{claims.plan}</dd>
							<dt className="text-ink-faint">{t("activation.fact.entitlements")}</dt>
							<dd className="truncate font-mono text-[10px] text-ink-soft">{claims.entitlements.join(" · ")}</dd>
							<dt className="text-ink-faint">{t("activation.fact.issuedAt")}</dt>
							<dd className="font-mono text-[10px] text-ink-soft">{claims.issuedAt}</dd>
							<dt className="text-ink-faint">{t("activation.fact.expiresAt")}</dt>
							<dd className="flex items-baseline gap-2">
								<span className="font-mono text-[10px] text-ink-soft">{claims.expiresAt}</span>
								<span className={`text-[10px] ${days <= 0 ? "text-fail" : days <= 30 ? "text-wait" : "text-ink-faint"}`}>
									{days > 0 ? t("activation.daysLeft", { count: days }) : t("activation.expiredNote")}
								</span>
							</dd>
						</dl>
					) : (
						<p className="mt-4 rounded-panel bg-inset/60 p-3 text-[11px] leading-5 text-ink-soft">
							{t("activation.hint")}
						</p>
					)}

					{data.rejectedCredential && data.rejectedCredential.status !== "active" && (
						<p className="mt-3 flex items-start gap-2 rounded-panel bg-fail-soft/40 p-2.5 text-[10px] leading-4 text-fail">
							<span className="icon-[lucide--x-circle] mt-0.5 size-3 shrink-0" />
							<span className="min-w-0 flex-1">
								{t("activation.rejected", {
									reason:
										data.rejectedCredential.status === "invalid"
											? data.rejectedCredential.reason
											: data.rejectedCredential.status,
								})}
							</span>
						</p>
					)}

					<label className="mt-4 block">
						<span className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
							{t("activation.tokenLabel")}
							<button type="button" onClick={paste} className="ml-auto normal-case tracking-normal text-ink-soft">
								{t("activation.paste")}
							</button>
						</span>
						<textarea
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							rows={4}
							spellCheck={false}
							placeholder={t("activation.placeholder")}
							className="mt-1.5 w-full resize-none rounded-panel border border-line bg-canvas px-2.5 py-2 font-mono text-[10px] leading-4 text-ink outline-none placeholder:text-ink-faint"
						/>
					</label>

					<div className="mt-3 flex items-center gap-2">
						<button
							type="button"
							disabled={busy || draft.trim().length === 0}
							onClick={() => void run(() => data.activate(draft.trim()))}
							className="flex h-8 items-center gap-1.5 rounded-control bg-ink px-3 text-[11px] font-medium text-canvas disabled:opacity-40"
						>
							<span className="icon-[lucide--key-round] size-3" />
							{t("activation.submit")}
						</button>
						<button
							type="button"
							disabled={busy || data.credentialSource === "none"}
							onClick={() => void run(() => data.clearCredential())}
							className="flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] text-ink-soft disabled:opacity-40"
						>
							{t("activation.clear")}
						</button>
						<span className="ml-auto text-[10px] text-ink-faint">{t("activation.offlineNote")}</span>
					</div>

					<div className="mt-5 border-t border-line-soft pt-3">
						<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
							{t("activation.rejectCodes")}
						</div>
						<ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
							{REJECTS.map((code) => (
								<li key={code} className="flex items-baseline gap-2 text-[10px]">
									<span
										className={`font-mono ${
											data.rejectedCredential?.status === "invalid" && data.rejectedCredential.reason === code
												? "text-fail"
												: "text-ink-soft"
										}`}
									>
										{code}
									</span>
									<span className="min-w-0 flex-1 truncate text-ink-faint">{t(`activation.reject.${code}`)}</span>
								</li>
							))}
						</ul>
						<p className="mt-2 text-[9.5px] leading-4 text-ink-faint">{t("activation.rejectNote")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
