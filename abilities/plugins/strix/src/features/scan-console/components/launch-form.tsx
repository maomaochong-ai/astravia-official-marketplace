/**
 * Composer: one target box, one optional focus box, and Start.
 *
 * Every control that is not needed to begin a scan was removed: depth and budget
 * default to Strix's own values and stay behind "more", because a first-run user
 * pressing Start should not have to reason about them.
 *
 * Validation is deliberately local (a target is any non-empty line) because Strix
 * itself rejects bad targets with a specific message at scan preparation;
 * duplicating its target inference here would drift from upstream.
 */

import { useState } from "react";
import type { StartScanRequest } from "../hooks/use-scan-console";

export interface LaunchFormProps {
	t: (key: string) => string;
	scanning: boolean;
	disabled?: boolean;
	onStart: (request: StartScanRequest) => Promise<void>;
	onCancel: () => Promise<void>;
}

const MODES = ["quick", "standard", "deep"] as const;

export function LaunchForm({ t, scanning, disabled, onStart, onCancel }: LaunchFormProps): React.ReactElement {
	const [targets, setTargets] = useState("");
	const [instruction, setInstruction] = useState("");
	const [mode, setMode] = useState<(typeof MODES)[number]>("deep");
	const [advanced, setAdvanced] = useState(false);

	const parsed = targets
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const submit = async (): Promise<void> => {
		if (!parsed.length || scanning) return;
		await onStart({
			targets: parsed,
			instruction: instruction.trim() || undefined,
			scanMode: mode,
		});
	};

	return (
		<section className="astra-strix-card">
			<textarea
				id="strix-targets"
				aria-label={t("launch.targets.label")}
				className="astra-strix-input astra-strix-textarea"
				placeholder={t("launch.targets.placeholder")}
				value={targets}
				onChange={(event) => setTargets(event.target.value)}
				onKeyDown={(event) => {
					// Enter starts; Shift+Enter is a newline, so several targets still work.
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						void submit();
					}
				}}
				rows={2}
				disabled={scanning}
			/>

			{advanced ? (
				<>
					<textarea
						id="strix-instruction"
						aria-label={t("launch.instruction.label")}
						className="astra-strix-input"
						placeholder={t("launch.single.placeholder")}
						value={instruction}
						onChange={(event) => setInstruction(event.target.value)}
						rows={2}
						disabled={scanning}
					/>
					<div className="astra-strix-row">
						<label className="astra-strix-label" htmlFor="strix-mode">
							{t("launch.mode.label")}
						</label>
						<select
							id="strix-mode"
							className="astra-strix-input astra-strix-select"
							value={mode}
							onChange={(event) => setMode(event.target.value as (typeof MODES)[number])}
							disabled={scanning}
						>
							{MODES.map((item) => (
								<option key={item} value={item}>
									{t(`launch.mode.${item}`)}
								</option>
							))}
						</select>
					</div>
				</>
			) : null}

			<div className="astra-strix-row astra-strix-actions">
				<button
					type="button"
					className="astra-strix-button astra-strix-button-primary"
					onClick={() => void submit()}
					disabled={disabled || scanning || parsed.length === 0}
				>
					{scanning ? t("launch.button.running") : t("launch.button.start")}
				</button>
				{scanning ? (
					<button type="button" className="astra-strix-button" onClick={() => void onCancel()}>
						{t("launch.button.cancel")}
					</button>
				) : null}
				<button type="button" className="astra-strix-link" onClick={() => setAdvanced((value) => !value)}>
					{advanced ? t("launch.less") : t("launch.more")}
				</button>
			</div>
		</section>
	);
}
