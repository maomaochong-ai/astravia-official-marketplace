/**
 * Strix's launch screen, reproduced for the activity tab.
 *
 * Shape and wording are upstream's (setup.go:setupBody): wordmark, tagline, the
 * composer with its model line inside the panel, the feedback log under it, and
 * the key hints closed by the version. What differs is who the model is: the chip
 * shows the host's model, because the loop runs on `ctx.ai`.
 *
 * The panel is a terminal surface - black, monospace, green accents - rather than
 * a host-themed card. That is the point of this tab: it looks like `strix` opening
 * in a terminal, so the launch screen has to be the one upstream ships.
 */

import { useState } from "react";
import type { ModelChoice } from "../../../domain/model-label";
import type { LogLine } from "../hooks/use-strix-session";
import { StrixWordmark } from "./strix-wordmark";

export interface LaunchScreenProps {
	t: (key: string) => string;
	model?: ModelChoice;
	log: readonly LogLine[];
	/** Bridge boot state. A live line, not a log entry (ADR strix-0004). */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	version: string;
	/** Why Enter cannot launch yet (no model, no Docker); empty when it can. */
	blocked?: string;
	busy: boolean;
	onSubmit: (value: string) => void;
	onQuit: () => void;
}

const MAX_LOG_ROWS = 6;

export function LaunchScreen({
	t,
	model,
	log,
	boot,
	version,
	blocked,
	busy,
	onSubmit,
	onQuit,
}: LaunchScreenProps): React.ReactElement {
	const [value, setValue] = useState("");

	const submit = (): void => {
		if (busy) return;
		onSubmit(value);
	};

	// Upstream opens at three rows and grows to eight before the composer scrolls.
	const rows = Math.min(8, Math.max(3, value.split("\n").length));

	return (
		<div
			className="astra-strix-term astra-strix-launch-surface"
			onKeyDown={(event) => {
				if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
					event.preventDefault();
					onQuit();
				}
			}}
		>
			<div className="astra-strix-launch">
				<div className="astra-strix-launch-head">
					<StrixWordmark />
					<p className="astra-strix-tagline">{t("launch.tagline")}</p>
				</div>

				{/* One panel holds the prompt and the model line, flush under it, the way
				    upstream's composer panel reads as a single unit. */}
				<div className="astra-strix-prompt" data-blocked={blocked ? "yes" : "no"}>
					<label className="astra-strix-prompt-row">
						<span className="astra-strix-prompt-caret" aria-hidden="true">
							&gt;
						</span>
						<textarea
							className="astra-strix-prompt-input"
							aria-label={t("launch.label")}
							placeholder={t("launch.placeholder")}
							rows={rows}
							autoFocus
							value={value}
							onChange={(event) => setValue(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
									event.preventDefault();
									submit();
								}
							}}
						/>
					</label>

					<p className="astra-strix-meta">
						{model ? (
							<>
								<span className="astra-strix-meta-dot" aria-hidden="true">
									●
								</span>
								<span className="astra-strix-meta-name">{model.name}</span>
								{model.provider ? <span className="astra-strix-dim"> · {model.provider}</span> : null}
							</>
						) : (
							<>
								<span className="astra-strix-amber" aria-hidden="true">
									○
								</span>
								<span className="astra-strix-amber">{t("launch.noModel")}</span>
								<span className="astra-strix-dim"> · {t("launch.noModelHint")}</span>
							</>
						)}
					</p>
				</div>

				{log.length ? (
					<div className="astra-strix-launch-log" role="status">
						{log.slice(-MAX_LOG_ROWS).map((line, index) => (
							<p key={`${index}-${line.text}`} className={line.tone ? `astra-strix-${line.tone}` : "astra-strix-dim"}>
								{line.text}
							</p>
						))}
					</div>
				) : null}

				<div className="astra-strix-hints">
					<span className="astra-strix-hints-left">
						<span className="astra-strix-hint">
							<span className="astra-strix-key">enter</span>
							<span className="astra-strix-dim">{t("launch.hint.enter")}</span>
						</span>
						<span className="astra-strix-hints-gap" />
						<span className="astra-strix-hint">
							<span className="astra-strix-key">ctrl+c</span>
							<span className="astra-strix-dim">{t("launch.hint.quit")}</span>
						</span>
					</span>
					<span className="astra-strix-dim">v{version}</span>
				</div>

				{boot.state === "connecting" ? (
					<p className="astra-strix-boot" role="status">
						<span className="astra-strix-spinner" aria-hidden="true" />
						<span>{t("boot.connecting")}</span>
					</p>
				) : boot.state === "failed" ? (
					<p className="astra-strix-boot" data-state="failed" role="status">
						<span className="astra-strix-amber" aria-hidden="true">!</span>
						<span>{t("boot.failed")}</span>
						{boot.detail ? <span className="astra-strix-dim"> — {boot.detail}</span> : null}
					</p>
				) : (
					<p className="astra-strix-boot" data-state="ready" role="status">
						<span className="astra-strix-green" aria-hidden="true">●</span>
						<span>{t("boot.ready")}</span>
					</p>
				)}

				{blocked ? <p className="astra-strix-launch-blocked">{blocked}</p> : null}
			</div>
		</div>
	);
}

