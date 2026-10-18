/**
 * The setup surface on the ability detail page.
 *
 * Firecrawl has no third-party OAuth client registration, so "authorize" cannot
 * be a redirect callback. It is instead the shortest honest path: open the
 * official API-key page, let the user sign in there, paste the key back, and
 * verify it before anything is stored. See docs/adr/0001-firecrawl-integration-mode.md.
 *
 * The slot gets no props beyond the ability identity, so it reads the shared
 * config instance from the setup registry filled during activation.
 */

import { useEffect, useState, type ReactElement } from "react";
import type { PluginAbilityDetailSlotProps } from "@astravia-org/plugin-sdk";
import { useTranslate } from "../crawler-console/hooks/use-translate";
import { getPluginContext } from "../../runtime/plugin-context";
import { AUTHORIZE_URL, type AccountState } from "../../runtime/config";
import { formatCount } from "../../shared/formatters/format";
import { openExternal } from "../../shared/open-external";
import { getSetupDeps } from "./deps";

function open(url: string): void {
	void openExternal(url).catch((error: unknown) => {
		getPluginContext().ui.notify({
			message: error instanceof Error ? error.message : String(error),
			error: true,
		});
	});
}

function creditsLine(account: AccountState): string | null {
	const remaining = account.remainingCredits;
	const plan = account.planCredits;
	if (remaining === undefined && plan === undefined) return null;
	if (remaining === undefined) return plan === undefined ? null : formatCount(plan);
	return plan === undefined ? formatCount(remaining) : `${formatCount(remaining)} / ${formatCount(plan)}`;
}

function renewsLine(account: AccountState): string | null {
	if (!account.billingPeriodEnd) return null;
	const at = new Date(account.billingPeriodEnd);
	if (Number.isNaN(at.getTime())) return null;
	return at.toLocaleDateString();
}

export function AbilitySetupSlot(_props: PluginAbilityDetailSlotProps): ReactElement | null {
	const t = useTranslate();
	const deps = getSetupDeps();
	const [account, setAccount] = useState<AccountState>(() => deps?.config.account ?? { connected: false });
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!deps) return;
		const unsubscribe = deps.config.subscribe(() => setAccount(deps.config.account));
		setAccount(deps.config.account);
		return unsubscribe;
	}, [deps]);

	if (!deps) return null;

	const connect = async (): Promise<void> => {
		setBusy(true);
		try {
			const ok = await deps.config.connect(key);
			if (ok) setKey("");
		} catch (error) {
			getPluginContext().ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		} finally {
			setBusy(false);
		}
	};

	const refresh = async (): Promise<void> => {
		setBusy(true);
		try {
			await deps.config.refreshAccount();
		} catch (error) {
			getPluginContext().ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		} finally {
			setBusy(false);
		}
	};

	const disconnect = async (): Promise<void> => {
		setBusy(true);
		try {
			await deps.config.disconnect();
		} finally {
			setBusy(false);
		}
	};

	const line = creditsLine(account);
	const renews = renewsLine(account);

	return (
		<section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
			<header className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium">{t("setup.title")}</span>
				<span
					className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
						account.connected
							? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
							: "bg-amber-500/15 text-amber-600 dark:text-amber-400"
					}`}
				>
					{account.connected ? t("setup.connected") : t("setup.keyless")}
				</span>
				{line ? (
					<span className="text-[11px] text-muted-foreground">
						{t("setup.remaining")}: <span className="font-mono text-foreground">{line}</span>
					</span>
				) : null}
				{renews ? (
					<span className="text-[11px] text-muted-foreground">
						{t("setup.renews")}: <span className="font-mono text-foreground">{renews}</span>
					</span>
				) : null}
			</header>

			<p className="text-[11px] leading-relaxed text-muted-foreground">
				{account.connected ? t("setup.keyedBody") : t("setup.keylessBody")}
			</p>

			{account.connected ? (
				<div className="flex flex-wrap items-center gap-1.5">
					<button
						type="button"
						disabled={busy}
						className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
						onClick={() => void refresh()}
					>
						{t("setup.refresh")}
					</button>
					<button
						type="button"
						className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted"
						onClick={() => open(AUTHORIZE_URL)}
					>
						{t("setup.manage")}
					</button>
					<button
						type="button"
						disabled={busy}
						className="ml-auto rounded border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
						onClick={() => void disconnect()}
					>
						{t("setup.disconnect")}
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-1.5">
					<div className="flex flex-wrap items-center gap-1.5">
						<button
							type="button"
							className="rounded bg-foreground px-2 py-0.5 text-[11px] font-medium text-background"
							onClick={() => open(AUTHORIZE_URL)}
						>
							{t("setup.authorize")}
						</button>
						<span className="text-[11px] text-muted-foreground">{t("setup.authorizeHint")}</span>
					</div>
					<div className="flex flex-wrap items-center gap-1.5">
						<input
							className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[11px]"
							value={key}
							placeholder={t("setup.keyPlaceholder")}
							spellCheck={false}
							autoComplete="off"
							type="password"
							onChange={(event) => setKey(event.target.value)}
						/>
						<button
							type="button"
							disabled={busy || key.trim().length === 0}
							className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
							onClick={() => void connect()}
						>
							{busy ? t("setup.connecting") : t("setup.connect")}
						</button>
					</div>
				</div>
			)}

			{account.error ? <p className="text-[11px] text-destructive">{account.error}</p> : null}
		</section>
	);
}
