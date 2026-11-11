/**
 * Model settings for the console: show what Strix will actually use, and line it
 * up with the model the user already drives Astravia with.
 *
 * The two systems hold their own credentials on purpose: Astravia keeps provider
 * keys in its main process and never passes them to a plugin (docs/plugin/ai.md:3),
 * and Strix drives its own agent loop with `STRIX_LLM` + a key. So the honest UI
 * separates "which model" from "is a credential there", shows the host's models
 * as the source of the name, and states the one exact variable still missing
 * instead of a blanket "no model".
 */

import type { ScanConsoleModel } from "../hooks/use-scan-console";
import type { HostModels } from "../../../domain/host-models";

export interface ModelPanelProps {
	t: (key: string) => string;
	model: ScanConsoleModel;
	hostModels?: HostModels;
	/** Adopt the given host model id and re-probe. */
	onUseHostModel: (modelKey: string) => Promise<void>;
}

export function ModelPanel({ t, model, hostModels, onUseHostModel }: ModelPanelProps): React.ReactElement | null {
	const llm = model.environment?.llm;
	if (!llm) return null;

	const configured = llm.configured;
	const hostPreferred = hostModels?.preferred;
	const differs = Boolean(hostPreferred && llm.model && hostPreferred !== llm.model);

	return (
		<div className="astra-strix-model">
			<p className="astra-strix-model-row">
				<span className={configured ? "astra-strix-green" : "astra-strix-red"}>{configured ? "✓" : "✗"}</span>
				<span className="astra-strix-dim">{t("setup.llm")}</span>
				<span>{llm.model || t("setup.modelUnset")}</span>
			</p>

			{/* The host's names are the ones the user recognises, so offer them by name. */}
			{hostPreferred ? (
				<p className="astra-strix-model-row">
					<span className="astra-strix-dim">{t("setup.hostModel")}</span>
					<span>{hostPreferred}</span>
					{differs ? (
						<button
							type="button"
							className="astra-strix-chip"
							onClick={() => void onUseHostModel(hostPreferred)}
						>
							{t("setup.useHostModel")}
						</button>
					) : null}
				</p>
			) : null}

			{!configured ? (
				<>
					{llm.missing.includes("model") ? <p className="astra-strix-hint">{t("setup.modelHint")}</p> : null}
					{llm.missing.includes("key") ? (
						<p className="astra-strix-hint">
							{t("setup.keyHint")} <code className="astra-strix-code">{llm.keyEnv || "LLM_API_KEY"}</code>
						</p>
					) : null}
					{llm.missing.includes("subscription") ? (
						<p className="astra-strix-hint">
							<code className="astra-strix-code">strix auth login chatgpt</code>
						</p>
					) : null}
					{llm.cloudAvailable ? <p className="astra-strix-hint">{t("setup.cloudHint")}</p> : null}
				</>
			) : null}
		</div>
	);
}
