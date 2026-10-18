/**
 * Connection bar: which endpoint answers tool calls, and the key that signs them.
 *
 * The API key is written straight to the host vault through the config object; it
 * is never held in a store, rendered back, or included in a tool argument.
 */

import { useEffect, useState, type ReactElement } from "react";
import { useTranslate } from "../hooks/use-translate";
import { AUTHORIZE_URL, type FirecrawlConfig } from "../../../runtime/config";
import { getPluginContext } from "../../../runtime/plugin-context";
import { openExternal } from "../../../shared/open-external";

export function ConnectionBar({ config }: { config: FirecrawlConfig }): ReactElement {
	const t = useTranslate();
	const [state, setState] = useState(() => config.state);
	const [expanded, setExpanded] = useState(false);
	const [endpoint, setEndpoint] = useState(state.settings.endpoint);
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => config.subscribe(() => setState(config.state)), [config]);
	useEffect(() => setEndpoint(state.settings.endpoint), [state.settings.endpoint]);

	const authorize = (): void => {
		void openExternal(AUTHORIZE_URL).catch((error: unknown) => {
			getPluginContext().ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		});
	};

	const save = async (patch: { endpoint?: string; apiKey?: string }): Promise<void> => {
		setBusy(true);
		try {
			await config.configure(patch);
			setKey("");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex shrink-0 flex-col gap-1 rounded border border-border/60 px-2 py-1">
			<div className="flex items-center gap-2">
				<span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("connection.label")}</span>
				<span
					className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
						state.hasKey
							? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
							: "bg-amber-500/15 text-amber-600 dark:text-amber-400"
					}`}
					title={state.reason || state.endpoint}
				>
					{state.hasKey ? t("connection.keyed") : t("connection.keyless")}
				</span>
				<span className="truncate font-mono text-[10px] text-muted-foreground">{state.endpoint}</span>
				<button
					type="button"
					className="ml-auto shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? t("connection.hide") : t("connection.setup")}
				</button>
			</div>

			{expanded ? (
				<div className="flex flex-col gap-1 border-t border-border/40 pt-1">
					<label className="flex items-center gap-2 text-[10px]">
						<span className="w-16 shrink-0 text-muted-foreground">{t("connection.endpoint")}</span>
						<input
							className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]"
							value={endpoint}
							placeholder="https://api.firecrawl.dev"
							spellCheck={false}
							onChange={(event) => setEndpoint(event.target.value)}
						/>
					</label>
					<label className="flex items-center gap-2 text-[10px]">
						<span className="w-16 shrink-0 text-muted-foreground">{t("connection.key")}</span>
						<input
							className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]"
							value={key}
							placeholder={t("connection.keyPlaceholder")}
							spellCheck={false}
							autoComplete="off"
							type="password"
							onChange={(event) => setKey(event.target.value)}
						/>
					</label>
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={busy}
							className="rounded bg-foreground px-2 py-0.5 text-[10px] font-medium text-background disabled:opacity-50"
							onClick={() => void save({ endpoint, ...(key.length > 0 ? { apiKey: key } : {}) })}
						>
							{t("connection.save")}
						</button>
						<button
							type="button"
							className="shrink-0 rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
							title={t("connection.authorizeHint")}
							onClick={authorize}
						>
							{t("connection.authorize")}
						</button>
						<span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={state.reason}>
							{state.reason || t("connection.ready")}
						</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
