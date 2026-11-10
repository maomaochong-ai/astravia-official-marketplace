/**
 * Launch surface: targets, focus, scan mode, and the two buttons that matter.
 *
 * Validation is deliberately local (a target is any non-empty line) because
 * Strix itself rejects bad targets with a specific message at scan preparation;
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
	const [budget, setBudget] = useState("");

	const parsed = targets
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const submit = async (): Promise<void> => {
		if (!parsed.length || scanning) return;
		const budgetValue = Number(budget);
		await onStart({
			targets: parsed,
			instruction: instruction.trim() || undefined,
			scanMode: mode,
			maxBudgetUsd: Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : undefined,
		});
	};

	return (
		<section className="astra-strix-card">
			<label className="astra-strix-label" htmlFor="strix-targets">
				{t("launch.targets.label")}
			</label>
			<textarea
				id="strix-targets"
				className="astra-strix-input astra-strix-textarea"
				placeholder={t("launch.targets.placeholder")}
				value={targets}
				onChange={(event) => setTargets(event.target.value)}
				rows={3}
				disabled={scanning}
			/>
			<p className="astra-strix-hint">{t("launch.targets.hint")}</p>

			<label className="astra-strix-label" htmlFor="strix-instruction">
				{t("launch.instruction.label")}
			</label>
			<textarea
				id="strix-instruction"
				className="astra-strix-input"
				placeholder={t("launch.instruction.placeholder")}
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

				<label className="astra-strix-label" htmlFor="strix-budget">
					{t("launch.budget.label")}
				</label>
				<input
					id="strix-budget"
					className="astra-strix-input astra-strix-budget"
					inputMode="decimal"
					placeholder={t("launch.budget.placeholder")}
					value={budget}
					onChange={(event) => setBudget(event.target.value)}
					disabled={scanning}
				/>
			</div>

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
			</div>
		</section>
	);
}
