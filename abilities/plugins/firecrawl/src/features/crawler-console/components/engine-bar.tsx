/**
 * Engine bar: which engine answers tool calls, and the credentials it needs.
 *
 * The API key is written straight to the host vault through the gate; it is never
 * held in a store, rendered back, or included in a tool argument.
 */

import { useEffect, useState, type ReactElement } from "react";
import { useTranslate } from "../hooks/use-translate";
import type { EngineChoice, UpstreamGate } from "../../../runtime/upstream";

const MODES: readonly EngineChoice[] = ["auto", "upstream", "local"];

export function EngineBar({ gate }: { gate: UpstreamGate }): ReactElement {
	const t = useTranslate();
	const [state, setState] = useState(() => gate.state);
	const [expanded, setExpanded] = useState(false);
	const [endpoint, setEndpoint] = useState(state.settings.endpoint);
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => gate.subscribe(() => setState(gate.state)), [gate]);
	useEffect(() => setEndpoint(state.settings.endpoint), [state.settings.endpoint]);

	const save = async (patch: { engine?: EngineChoice; endpoint?: string; apiKey?: string }): Promise<void> => {
		setBusy(true);
		try {
			await gate.configure(patch);
			setKey("");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex shrink-0 flex-col gap-1 rounded border border-border/60 px-2 py-1">
			<div className="flex items-center gap-2">
				<span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("engine.label")}</span>
				<select
					className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]"
					value={state.settings.engine}
					onChange={(event) => void save({ engine: event.target.value as EngineChoice })}
				>
					{MODES.map((mode) => (
						<option key={mode} value={mode}>
							{t(`engine.mode.${mode}`)}
						</option>
					))}
				</select>
				<span
					className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
						state.configured ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
					}`}
					title={state.reason || state.endpoint}
				>
					{state.configured ? t("engine.on") : t("engine.off")}
				</span>
				<span className="truncate font-mono text-[10px] text-muted-foreground">{state.endpoint}</span>
				<button
					type="button"
					className="ml-auto shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? t("engine.hide") : t("engine.setup")}
				</button>
			</div>

			{expanded ? (
				<div className="flex flex-col gap-1 border-t border-border/40 pt-1">
					<label className="flex items-center gap-2 text-[10px]">
						<span className="w-16 shrink-0 text-muted-foreground">{t("engine.endpoint")}</span>
						<input
							className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]"
							value={endpoint}
							placeholder="https://api.firecrawl.dev"
							spellCheck={false}
							onChange={(event) => setEndpoint(event.target.value)}
						/>
					</label>
					<label className="flex items-center gap-2 text-[10px]">
						<span className="w-16 shrink-0 text-muted-foreground">{t("engine.key")}</span>
						<input
							className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]"
							value={key}
							placeholder={t("engine.keyPlaceholder")}
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
							{t("engine.save")}
						</button>
						<span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={state.reason}>
							{state.reason || t("engine.ready")}
						</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
