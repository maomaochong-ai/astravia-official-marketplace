import { useRef, useState } from "react";
import { tryGetStudioRuntime } from "../../../../plugin-context.js";
import { TOKEN_PREFIX } from "../../../../entitlement/credential-token.js";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";

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

/** 凭证输入框的容纳上限；宿主侧没有更短的限额，这里按设计稿的 2,048 收口。 */
const TOKEN_LIMIT = 2048;

/**
 * 激活页：离线验签的现场。
 *
 * 页面上每个数字都是验签当场算出来的：签发主体、权益清单、到期时间、还剩几天、凭证从哪来的。
 * 这里没有「机器指纹」——凭证里就没有这个字段，写上去是假的。验签失败时显示的是真实拒绝码，
 * 不是「网络异常」。
 *
 * 这一页是 `bare`（不画窄栏），所以必须有自己的一扇门退回工作台，否则进来就出不去。
 */
export function ActivationPage({ data, onNavigate }: { data: StudioState; onNavigate(page: WorkbenchPage): void }) {
	const t = useTranslator();
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
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

	// 凭证本来就是一串文本，作者常常是收到文件而不是收到一条消息：直接读进输入框，
	// 不引入任何新的存储或解析路径，落盘的仍然只有用户按下「激活」的那一次。
	const importFromFile = async (file: File) => {
		try {
			const text = await file.text();
			const trimmed = text.trim();
			if (trimmed.length > 0) setDraft(trimmed.slice(0, TOKEN_LIMIT));
		} catch {
			tryGetStudioRuntime()?.ctx.ui.notify({ message: t("activation.importFailed"), variant: "error" });
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
			<button
				type="button"
				onClick={() => onNavigate("shelf")}
				className="mb-2 inline-flex w-fit items-center gap-1 px-1 text-micro text-ink-soft hover:text-ink"
			>
				<span className="icon-[lucide--arrow-left] size-3" />
				{t("activation.back")}
			</button>

			<div className="flex min-h-0 flex-1 flex-col gap-3 @min-[900px]:flex-row">
				<aside className="flex w-full shrink-0 flex-col justify-between overflow-hidden rounded-sheet border border-line bg-inset px-6 py-6 @min-[900px]:w-[420px] @min-[900px]:px-9 @min-[900px]:py-9">
					<div>
						<div className="flex size-11 items-center justify-center rounded-[3px] bg-cinnabar font-display text-title text-cinnabar-foreground">
							{t("activation.mark")}
						</div>
						<h1 className="mt-6 font-display text-title font-semibold text-ink">{t("activation.brand")}</h1>
						<p className="mt-1 text-body-sm text-ink-soft">{t("activation.brandLine")}</p>

						<ul className="mt-7 space-y-3">
							{["offline", "keys", "noAccount"].map((key, index) => (
								<li key={key} className="flex items-center gap-2.5">
									<span
										className={`${
											["icon-[lucide--wifi-off]", "icon-[lucide--laptop]", "icon-[lucide--calendar-clock]"][index] ??
											"icon-[lucide--check]"
										} size-3.5 shrink-0 text-cinnabar`}
									/>
									<span className="text-micro leading-4 text-ink/75">{t(`activation.point.${key}`)}</span>
								</li>
							))}
						</ul>
					</div>

					<div className="border-t border-line pt-5">
						<p className="font-display text-body leading-7 text-ink/85">{t("activation.quote")}</p>
						<div className="mt-3 flex items-baseline justify-between gap-3">
							<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
								{t("activation.signingKeys")}
							</span>
							<span className="text-[9.5px] text-ink-faint">{t("activation.keysNote")}</span>
						</div>
						<ul className="mt-1.5 space-y-1">
							{data.trustedKeys().map((key) => (
								<li key={key.keyId} className="flex items-center gap-2 font-mono text-[10px] text-ink-soft">
									<span className="text-ink">{key.keyId}</span>
									<span className="min-w-0 flex-1 truncate">{key.publicKey}</span>
								</li>
							))}
						</ul>
					</div>
				</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-sheet bg-surface px-8 py-7 shadow-raise">
					<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
						<div className="flex items-baseline gap-2">
							<h2 className="font-display text-heading font-semibold text-ink">{t("activation.title")}</h2>
							<span
								className={`flex h-6 items-center gap-1.5 rounded-pill px-2 text-[10px] font-medium ${
									active ? "bg-pass-soft text-pass" : "bg-wait-soft text-wait"
								}`}
							>
								<span className={`size-1.5 rounded-pill ${active ? "bg-pass" : "bg-wait"}`} />
								{t(`activation.status.${state.status}`)}
							</span>
							<span className="text-[10px] text-ink-faint">{t(`activation.source.${data.credentialSource}`)}</span>
						</div>
						<p className="max-w-[42ch] text-right text-[10px] leading-4 text-ink-faint">{t("activation.footnote")}</p>
					</div>

					<p className="mt-1.5 max-w-[62ch] text-body-sm leading-5 text-ink-soft">
						{t("activation.intro", { prefix: `${TOKEN_PREFIX}.…` })}
					</p>

					<div className="mt-5 flex items-baseline justify-between">
						<span className="text-[10px] tracking-wide text-ink-faint">{t("activation.tokenLabel")}</span>
						<button type="button" onClick={paste} className="flex items-center gap-1 py-0.5 text-[10px] text-ink-soft">
							<span className="icon-[lucide--clipboard] size-3" />
							{t("activation.paste")}
						</button>
					</div>

					<div className="mt-1.5 flex min-h-[168px] flex-col overflow-hidden rounded-control border border-line-strong bg-inset">
						<textarea
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							maxLength={TOKEN_LIMIT}
							spellCheck={false}
							placeholder={t("activation.placeholder")}
							className="min-h-0 flex-1 resize-none break-all bg-transparent px-3.5 py-3 font-mono text-[11px] leading-[1.6] text-ink outline-none placeholder:text-ink-faint"
						/>
						<div className="flex items-center justify-between border-t border-line-soft px-3.5 py-2 text-[10px] text-ink-faint">
							<span>{t("activation.limitNote")}</span>
							<span className="font-mono">
								{t("activation.counter", { count: draft.length, limit: TOKEN_LIMIT })}
							</span>
						</div>
					</div>

					<div className="mt-3 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-control border border-line bg-raised @min-[640px]:grid-cols-[auto_1fr_1fr] @min-[640px]:divide-x @min-[640px]:divide-y-0">
						<div className="flex h-10 items-center gap-2 px-3.5">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.version")}</span>
							<span className="font-mono text-micro text-ink/80">{TOKEN_PREFIX}</span>
						</div>
						<div className="flex h-10 items-center gap-2 px-3.5">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.keyId")}</span>
							<span className="min-w-0 truncate font-mono text-micro text-ink/80">{claims?.keyId ?? "—"}</span>
							{claims ? (
								<span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-pass">
									<span className="icon-[lucide--shield-check] size-3" />
									{t("activation.fact.onDevice")}
								</span>
							) : null}
						</div>
						<div className="flex h-10 items-center gap-2 px-3.5">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.expiresAt")}</span>
							<span className="min-w-0 truncate font-mono text-micro text-ink/80">
								{claims ? claims.expiresAt.slice(0, 10) : "—"}
							</span>
							{claims ? (
								<span
									className={`ml-auto shrink-0 text-[10px] ${days <= 0 ? "text-fail" : days <= 30 ? "text-wait" : "text-ink-soft"}`}
								>
									{days > 0 ? t("activation.daysLeft", { days }) : t("activation.expiredNote")}
								</span>
							) : null}
						</div>
					</div>

					<div className="mt-4 flex items-center gap-2">
						<button
							type="button"
							disabled={busy || draft.trim().length === 0}
							onClick={() => void run(() => data.activate(draft.trim()))}
							className="flex h-8 items-center gap-1.5 rounded-control bg-ink px-3.5 text-micro font-medium text-surface disabled:opacity-40"
						>
							<span className="icon-[lucide--key-round] size-3.5" />
							{t("activation.submit")}
						</button>
						<input
							ref={fileRef}
							type="file"
							accept=".txt,.token,.json,text/plain,application/json"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) void importFromFile(file);
							}}
						/>
						<button
							type="button"
							disabled={busy}
							onClick={() => fileRef.current?.click()}
							className="flex h-8 items-center gap-1.5 rounded-control border border-line-strong px-3 text-micro text-ink disabled:opacity-40"
						>
							<span className="icon-[lucide--file-input] size-3.5" />
							{t("activation.import")}
						</button>
						<button
							type="button"
							disabled={busy || data.credentialSource === "none"}
							onClick={() => void run(() => data.clearCredential())}
							className="flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-micro text-ink-soft disabled:opacity-40"
						>
							{t("activation.clear")}
						</button>
						<span className="ml-auto text-[10px] text-ink-faint">{t("activation.verifyNote")}</span>
					</div>

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
						</dl>
					) : (
						<p className="mt-4 rounded-panel bg-inset/60 p-3 text-[11px] leading-5 text-ink-soft">
							{t("activation.hint")}
						</p>
					)}

					<div className="mt-6 grid gap-8 border-t border-line pt-5 @min-[720px]:grid-cols-2">
						<div>
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h3 className="text-[10px] font-semibold tracking-[0.08em] text-ink">{t("activation.fail.title")}</h3>
								<span className="text-[10px] text-ink-faint">{t("activation.fail.note")}</span>
							</div>
							<ul className="mt-2 grid gap-1.5">
								{REJECTS.map((code) => (
									<li
										key={code}
										className={`flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 ${
											data.rejectedCredential?.status === "invalid" && data.rejectedCredential.reason === code
												? "border-fail bg-fail-soft/40"
												: "bg-raised"
										}`}
									>
										<span className="shrink-0 font-mono text-[10px] text-fail">{code}</span>
										<span className="min-w-0 truncate text-[10px] text-ink-soft">{t(`activation.reject.${code}`)}</span>
									</li>
								))}
							</ul>
							<p className="mt-2 text-[9.5px] leading-4 text-ink-faint">{t("activation.rejectNote")}</p>
						</div>
						<div>
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h3 className="text-[10px] font-semibold tracking-[0.08em] text-ink">{t("activation.opens.title")}</h3>
								<span className="text-[10px] text-ink-faint">{t("activation.opens.note")}</span>
							</div>
							<ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-ink-soft">
								{["workspace", "team", "move"].map((key) => (
									<li key={key} className="flex items-start gap-1.5">
										<span className="mt-1.5 size-1 shrink-0 rounded-full bg-cinnabar" />
										{t(`activation.opens.${key}`)}
									</li>
								))}
							</ul>
						</div>
					</div>

					<div className="mt-auto flex items-center gap-2 pt-5 text-[10px] text-ink-faint">
						<span className="icon-[lucide--info] size-3" />
						{t("activation.offlineNote")}
					</div>
				</div>
			</div>
		</div>
	);
}
