import { useRef, useState } from "react";
import { tryGetStudioRuntime } from "../../../../plugin-context.js";
import { TOKEN_PREFIX } from "../../../../entitlement/credential-token.js";
import { subjectLabel } from "../../../../entitlement/subject-label.js";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { PageHeader } from "../shell/PageHeader";

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

/** 左侧三条卖点：离线可验 / 公钥在包内 / 不要账号。图标与文案一一对应，顺序不可换。 */
const POINTS = [
	{ key: "offline", icon: "icon-[solar--cloud-cross-linear]" },
	{ key: "keys", icon: "icon-[solar--key-minimalistic-square-3-linear]" },
	{ key: "noAccount", icon: "icon-[solar--user-cross-rounded-linear]" },
] as const;

/**
 * 激活页：离线验签的现场。
 *
 * 页面上每个数字都是验签当场算出来的：签发主体、权益清单、到期时间、还剩几天、凭证从哪来的。
 * 这里没有「机器指纹」——凭证里就没有这个字段，写上去是假的。验签失败时显示的是真实拒绝码，
 * 不是「网络异常」。
 *
 * 这一页是 `bare`（不画窄栏），所以必须有自己的一扇门退回工作台，否则进来就出不去——
 * 门在 `PageHeader` 的 `back` 上，与其他页同一个位置。
 *
 * 排版按 ADR 0033 重做：整页只有两张卡，卡内所有分组都是凹槽（`bg-well`），
 * 凹槽里再抬起来的只有真正可点的东西。原来那批 `border` / `divide-y` / `border-t`
 * 全部换成底色分层——这一页原本是全插件线条最密的地方。
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

	const rejectedReason =
		data.rejectedCredential && data.rejectedCredential.status !== "active" ? data.rejectedCredential : null;

	return (
		<div className="mahua-page mahua-scroll min-h-0 flex-1 overflow-y-auto">
			<PageHeader
				back={{ label: t("activation.back"), onBack: () => onNavigate("shelf") }}
				title={t("activation.title")}
				meta={
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span
							className={`flex h-6 items-center gap-1.5 rounded-pill px-2 text-[10px] font-medium ${
								active ? "bg-pass-soft text-pass" : "bg-wait-soft text-wait"
							}`}
						>
							<span className={`size-1.5 rounded-pill ${active ? "bg-pass" : "bg-wait"}`} />
							{t(`activation.status.${state.status}`)}
						</span>
						<span className="text-[10px] text-ink-faint">{t(`activation.source.${data.credentialSource}`)}</span>
					</span>
				}
				right={<span className="max-w-[38ch] text-right text-[10px] leading-4 text-ink-faint">{t("activation.footnote")}</span>}
			/>

			{/* 两栏：左卡说「这是什么」，右卡做「现在验一次」。
			 * 900px 以下改成上下堆叠，且**只保留外层这一条滚动条**——从前右栏自己还滚一层，
			 * 面板一窄就变成两个互相独立的滚动区，光标滚哪个全凭运气。 */}
			<div className="mt-3 flex flex-col gap-3 @min-[900px]:flex-row @min-[900px]:items-start">
				<aside className="mahua-card flex w-full shrink-0 flex-col gap-4 p-4 @min-[900px]:w-[360px] @min-[900px]:p-5">
					<div>
						<div className="flex size-11 items-center justify-center rounded-tile bg-cinnabar font-display text-title text-cinnabar-foreground">
							{t("activation.mark")}
						</div>
						<h2 className="mt-4 font-display text-title font-semibold text-ink">{t("activation.brand")}</h2>
						<p className="mt-1 text-body-sm text-ink-soft">{t("activation.brandLine")}</p>
					</div>

					<ul className="flex flex-col gap-1 rounded-panel bg-well p-2">
						{POINTS.map((point) => (
							<li key={point.key} className="flex items-start gap-2 px-2 py-1">
								<span className={`${point.icon} mt-0.5 size-3.5 shrink-0 text-cinnabar`} />
								<span className="min-w-0 text-micro leading-4 text-ink-soft">{t(`activation.point.${point.key}`)}</span>
							</li>
						))}
					</ul>

					<p className="rounded-panel bg-well p-3 font-display text-body leading-7 text-ink">
						{t("activation.quote")}
					</p>

					<div className="rounded-panel bg-well p-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
								{t("activation.signingKeys")}
							</span>
							<span className="text-[9.5px] text-ink-faint">{t("activation.keysNote")}</span>
						</div>
						<ul className="mt-1.5 flex flex-col gap-1">
							{data.trustedKeys().map((key) => (
								<li
									key={key.keyId}
									className="flex items-center gap-2 rounded-control bg-raised px-2 py-1 font-mono text-[10px] text-ink-soft"
								>
									<span className="shrink-0 text-ink">{key.keyId}</span>
									<span className="min-w-0 flex-1 truncate">{key.publicKey}</span>
								</li>
							))}
						</ul>
					</div>
				</aside>

				<div className="mahua-card flex min-w-0 flex-1 flex-col gap-3 p-4 @min-[900px]:p-5">
					<p className="max-w-[62ch] text-body-sm leading-5 text-ink-soft">
						{t("activation.intro", { prefix: `${TOKEN_PREFIX}.…` })}
					</p>

					<div>
						<div className="flex items-baseline justify-between gap-3">
							<span className="text-[10px] tracking-wide text-ink-faint">{t("activation.tokenLabel")}</span>
							<button
								type="button"
								onClick={paste}
								className="flex items-center gap-1 rounded-control px-1.5 py-0.5 text-[10px] text-ink-soft transition-colors hover:bg-wash hover:text-ink"
							>
								<span className="icon-[solar--clipboard-linear] size-3" />
								{t("activation.paste")}
							</button>
						</div>

						<div className="mt-1.5 flex min-h-[168px] flex-col overflow-hidden rounded-panel bg-well">
							<textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								maxLength={TOKEN_LIMIT}
								spellCheck={false}
								placeholder={t("activation.placeholder")}
								className="min-h-0 flex-1 resize-none break-all bg-transparent px-3.5 py-3 font-mono text-[11px] leading-[1.6] text-ink outline-none placeholder:text-ink-faint"
							/>
							<div className="flex items-center justify-between px-3.5 pb-2 text-[10px] text-ink-faint">
								<span>{t("activation.limitNote")}</span>
								<span className="font-mono">
									{t("activation.counter", { count: draft.length, limit: TOKEN_LIMIT })}
								</span>
							</div>
						</div>
					</div>

					{/* 三条事实各占一格小凹槽：标签在上、值在下。从前是「标签 · 值 · 徽记」挤在 40px 里，
					 * 128px 宽时「签发密钥」和密钥本身会互相顶。 */}
					<div className="grid grid-cols-1 gap-2 @min-[560px]:grid-cols-3">
						<div className="flex min-w-0 flex-col gap-0.5 rounded-control bg-well px-3 py-2">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.version")}</span>
							<span className="truncate font-mono text-micro text-ink/80">{TOKEN_PREFIX}</span>
						</div>
						<div className="flex min-w-0 flex-col gap-0.5 rounded-control bg-well px-3 py-2">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.keyId")}</span>
							<span className="flex min-w-0 items-center gap-1">
								<span className="min-w-0 truncate font-mono text-micro text-ink/80">{claims?.keyId ?? "—"}</span>
								{claims ? (
									<span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-pass">
										<span className="icon-[solar--shield-check-linear] size-3" />
										{t("activation.fact.onDevice")}
									</span>
								) : null}
							</span>
						</div>
						<div className="flex min-w-0 flex-col gap-0.5 rounded-control bg-well px-3 py-2">
							<span className="text-[10px] text-ink-faint">{t("activation.fact.expiresAt")}</span>
							<span className="flex min-w-0 items-center gap-1">
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
							</span>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={busy || draft.trim().length === 0}
							onClick={() => void run(() => data.activate(draft.trim()))}
							className="flex h-8 items-center gap-1.5 rounded-control bg-cinnabar px-3.5 text-micro font-medium text-cinnabar-foreground transition-colors hover:bg-cinnabar/88 disabled:opacity-40"
						>
							<span className="icon-[solar--key-bold] size-3.5" />
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
							className="flex h-8 items-center gap-1.5 rounded-control bg-well px-3 text-micro text-ink transition-colors hover:bg-wash-strong disabled:opacity-40"
						>
							<span className="icon-[solar--file-add-linear] size-3.5" />
							{t("activation.import")}
						</button>
						<button
							type="button"
							disabled={busy || data.credentialSource === "none"}
							onClick={() => void run(() => data.clearCredential())}
							className="flex h-8 items-center gap-1.5 rounded-control px-2 text-micro text-ink-soft transition-colors hover:bg-wash hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
						>
							{t("activation.clear")}
						</button>
						<span className="ml-auto text-[10px] text-ink-faint">{t("activation.verifyNote")}</span>
					</div>

					{rejectedReason && (
						<p className="flex items-start gap-2 rounded-panel bg-fail-soft/40 p-2.5 text-[10px] leading-4 text-fail">
							<span className="icon-[solar--close-circle-linear] mt-0.5 size-3 shrink-0" />
							<span className="min-w-0 flex-1">
								{t("activation.rejected", {
									reason: rejectedReason.status === "invalid" ? rejectedReason.reason : rejectedReason.status,
								})}
							</span>
						</p>
					)}

					{claims ? (
						<dl className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1.5 rounded-panel bg-well p-3 text-[11px]">
							<dt className="text-ink-faint">{t("activation.fact.subject")}</dt>
							<dd className="min-w-0 truncate text-ink">{subjectLabel(claims.subject)}</dd>
							<dt className="text-ink-faint">{t("activation.fact.plan")}</dt>
							<dd className="min-w-0 truncate text-ink">{claims.plan}</dd>
							<dt className="text-ink-faint">{t("activation.fact.entitlements")}</dt>
							<dd className="min-w-0 truncate font-mono text-[10px] text-ink-soft">{claims.entitlements.join(" · ")}</dd>
							<dt className="text-ink-faint">{t("activation.fact.issuedAt")}</dt>
							<dd className="min-w-0 truncate font-mono text-[10px] text-ink-soft">{claims.issuedAt}</dd>
						</dl>
					) : (
						<p className="rounded-panel bg-well p-3 text-[11px] leading-5 text-ink-soft">{t("activation.hint")}</p>
					)}

					{/* 拒绝码与「能开什么」并排。两块都是凹槽，块内条目抬起来——这样当前命中的
					 * 那一条（`bg-fail-soft`）在纸面上是最显眼的，不需要再用描边圈它。 */}
					<div className="grid gap-3 @min-[720px]:grid-cols-2">
						<div className="rounded-panel bg-well p-3">
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h3 className="text-[10px] font-semibold tracking-[0.08em] text-ink">{t("activation.fail.title")}</h3>
								<span className="text-[10px] text-ink-faint">{t("activation.fail.note")}</span>
							</div>
							<ul className="mt-2 flex flex-col gap-1">
								{REJECTS.map((code) => {
									const hit = rejectedReason?.status === "invalid" && rejectedReason.reason === code;
									return (
										<li
											key={code}
											className={`flex items-center gap-2 rounded-control px-2 py-1 ${
												hit ? "bg-fail-soft" : "bg-raised"
											}`}
										>
											<span className="shrink-0 font-mono text-[10px] text-fail">{code}</span>
											<span className="min-w-0 truncate text-[10px] text-ink-soft">{t(`activation.reject.${code}`)}</span>
										</li>
									);
								})}
							</ul>
							<p className="mt-2 text-[9.5px] leading-4 text-ink-faint">{t("activation.rejectNote")}</p>
						</div>

						<div className="rounded-panel bg-well p-3">
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h3 className="text-[10px] font-semibold tracking-[0.08em] text-ink">{t("activation.opens.title")}</h3>
								<span className="text-[10px] text-ink-faint">{t("activation.opens.note")}</span>
							</div>
							<ul className="mt-2 flex flex-col gap-1.5 text-[10px] leading-4 text-ink-soft">
								{["workspace", "team", "move"].map((key) => (
									<li key={key} className="flex items-start gap-1.5">
										<span className="mt-1.5 size-1 shrink-0 rounded-pill bg-cinnabar" />
										<span className="min-w-0">{t(`activation.opens.${key}`)}</span>
									</li>
								))}
							</ul>
						</div>
					</div>

					<div className="flex items-center gap-2 text-[10px] text-ink-faint">
						<span className="icon-[solar--info-circle-linear] size-3 shrink-0" />
						{t("activation.offlineNote")}
					</div>
				</div>
			</div>
		</div>
	);
}
