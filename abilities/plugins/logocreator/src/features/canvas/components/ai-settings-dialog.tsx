import { useEffect, useState, type JSX } from "react";
import type { HostImageProvider } from "../../../domain/ai/host-media";
import type { PluginSettings } from "../../../domain/settings";
import { BUTTON_SECONDARY, FOCUS_RING, SECTION_LABEL } from "../../../shared/styles/tokens";
import { ModalDialog } from "../../../shared/components/modal-dialog";

export interface AiSettingsDialogProps {
	open: boolean;
	settings: PluginSettings;
	providers: HostImageProvider[];
	/** `media.generate` was refused by the host; only re-authorising fixes it. */
	denied: boolean;
	onClose: () => void;
	onChooseProvider: (providerId: string | undefined) => void;
	onRefresh: () => Promise<void>;
	t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Where AI marks come from.
 *
 * Deliberately read-only about credentials: the provider, its account and its
 * billing already live in Astravia's own settings, and this dialog only picks
 * which of the connected image models to spend. There is no key field, because
 * shipping one would mean a second credential store and a second egress path for
 * a capability the host already owns.
 */
export function AiSettingsDialog({
	open,
	settings,
	providers,
	denied,
	onClose,
	onChooseProvider,
	onRefresh,
	t,
}: AiSettingsDialogProps): JSX.Element {
	const [refreshing, setRefreshing] = useState(false);

	useEffect(() => {
		if (!open) return;
		setRefreshing(true);
		void onRefresh().finally(() => setRefreshing(false));
	}, [open, onRefresh]);

	const active = settings.providerId ?? providers[0]?.id;

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
						onClick={() => {
							setRefreshing(true);
							void onRefresh().finally(() => setRefreshing(false));
						}}
						disabled={refreshing}
						className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}
					>
						{refreshing ? t("ai.refreshing") : t("ai.refresh")}
					</button>
					<span className="flex-1" />
					<span className={`text-[10.5px] ${providers.length > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
						{providers.length > 0 ? t("ai.ready", { count: providers.length }) : denied ? t("ai.deniedShort") : t("ai.none")}
					</span>
				</div>
			}
		>
			<div className="space-y-3">
				{providers.length === 0 ? (
					<p
						className={`rounded-lg px-3 py-2 text-[11.5px] leading-relaxed ${
							denied ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted/60 text-muted-foreground"
						}`}
					>
						{denied ? t("ai.denied") : t("ai.noneBody")}
					</p>
				) : (
					<div>
						<span className={SECTION_LABEL}>{t("ai.provider")}</span>
						<ul className="space-y-1">
							{providers.map((provider) => {
								const selected = provider.id === active;
								return (
									<li key={provider.id}>
										<button
											type="button"
											onClick={() => onChooseProvider(provider.id)}
											aria-pressed={selected}
											className={`${FOCUS_RING} flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
												selected ? "border-primary bg-primary/10" : "border-border hover:border-foreground/25"
											}`}
										>
											<span className="min-w-0">
												<span className="block truncate text-[12px] font-medium text-foreground">{provider.displayName}</span>
												<span className="block truncate text-[10px] text-muted-foreground">
													{provider.modelId ?? t("ai.providerDefaultModel")}
												</span>
											</span>
											{selected ? (
												<svg viewBox="0 0 24 24" className="size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
													<path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
												</svg>
											) : null}
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				)}

				<p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
					{t("ai.cost")}
				</p>
				<p className="text-[10.5px] leading-relaxed text-muted-foreground">{t("ai.engineNote")}</p>
			</div>
		</ModalDialog>
	);
}
