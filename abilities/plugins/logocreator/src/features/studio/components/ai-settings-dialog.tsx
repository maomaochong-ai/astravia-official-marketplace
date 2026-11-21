import { useState, type JSX } from "react";
import { suggestedModels } from "../../../domain/studio-settings";
import type { StudioSettings } from "../../../domain/studio-settings";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING, INPUT, SECTION_LABEL } from "../../../shared/styles/tokens";
import { ModalDialog } from "../../../shared/components/modal-dialog";

export interface AiSettingsDialogProps {
	open: boolean;
	settings: StudioSettings;
	hasKey: boolean;
	onClose: () => void;
	onSaveKey: (key: string) => Promise<void>;
	onForgetKey: () => Promise<void>;
	onUpdateSettings: (patch: Partial<StudioSettings>) => void;
	onOpenExternal: (url: string) => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Connect Together AI.
 *
 * The key is written to host secret storage, never to a settings file, and is
 * never read back into the input — `hasKey` is the only local fact. That is why
 * the field starts empty even when a key is already connected.
 */
export function AiSettingsDialog({
	open,
	settings,
	hasKey,
	onClose,
	onSaveKey,
	onForgetKey,
	onUpdateSettings,
	onOpenExternal,
	t,
}: AiSettingsDialogProps): JSX.Element {
	const [draft, setDraft] = useState("");
	const [saving, setSaving] = useState(false);

	const save = async () => {
		if (!draft.trim()) return;
		setSaving(true);
		try {
			await onSaveKey(draft);
			setDraft("");
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalDialog
			open={open}
			onClose={onClose}
			title={t("ai.title")}
			description={t("ai.description")}
			footer={
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => void save()}
						disabled={saving || draft.trim().length === 0}
						className={`${BUTTON_PRIMARY} ${FOCUS_RING}`}
					>
						{saving ? t("ai.saving") : t("ai.save")}
					</button>
					{hasKey ? (
						<button type="button" onClick={() => void onForgetKey()} className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}>
							{t("ai.forget")}
						</button>
					) : null}
					<span className="flex-1" />
					<span className={`text-[10.5px] ${hasKey ? "text-emerald-600" : "text-muted-foreground"}`}>
						{hasKey ? t("ai.connected") : t("ai.notConnected")}
					</span>
				</div>
			}
		>
			<div className="space-y-3">
				<label className="block">
					<span className={SECTION_LABEL}>{t("ai.key")}</span>
					<input
						type="password"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={hasKey ? t("ai.keyPlaceholderStored") : "sk-…"}
						autoComplete="off"
						spellCheck={false}
						className={INPUT}
					/>
				</label>

				<button
					type="button"
					onClick={() => onOpenExternal("https://api.together.xyz/settings/api-keys")}
					className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
				>
					{t("ai.getKey")}
				</button>

				<label className="block">
					<span className={SECTION_LABEL}>{t("ai.model")}</span>
					<select
						value={settings.model}
						onChange={(event) => onUpdateSettings({ model: event.target.value })}
						className={`${INPUT} cursor-pointer`}
					>
						{suggestedModels().map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
					</select>
				</label>

				<p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
					{t("ai.cost")}
				</p>
			</div>
		</ModalDialog>
	);
}
