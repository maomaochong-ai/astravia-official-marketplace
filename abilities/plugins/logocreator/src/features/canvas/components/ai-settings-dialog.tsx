import { useEffect, useRef, useState, type JSX } from "react";
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
	/** Which engine the next run uses. Without this the vector line is unreachable. */
	mode: "local" | "ai";
	onChooseMode: (mode: "local" | "ai") => void;
	onClose: () => void;
	onChooseProvider: (providerId: string | undefined) => void;
	onRefresh: () => Promise<void>;
	t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Where marks come from — and which of the two engines runs.
 *
 * 早先这里只列 provider：一旦宿主连了任何图像模型，`use-generation` 就把模式自动切成
 * AI，而界面上没有任何地方能切回矢量引擎 —— 想再要 SVG / 品牌手册只能等 AI 失败。
 * 所以引擎选择放在这里：它是「这次生成花不花钱、出不出矢量」的决定，与选哪家模型同类。
 *
 * 凭据仍然是只读的：provider、账户与计费都在 Astravia 自己的设置里，这里只挑花谁的钱。
 */
export function AiSettingsDialog({
	open,
	settings,
	providers,
	denied,
	mode,
	onChooseMode,
	onClose,
	onChooseProvider,
	onRefresh,
	t,
}: AiSettingsDialogProps): JSX.Element {
	const [refreshing, setRefreshing] = useState(false);
	const probed = useRef(false);

	// 首次打开探一次就够了：provider 列表变化由 footer 的刷新按钮与宿主的连接状态驱动，
	// 每次打开都探一遍等于每次开面板都多一次宿主调用。
	useEffect(() => {
		if (!open || probed.current) return;
		probed.current = true;
		setRefreshing(true);
		void onRefresh().finally(() => setRefreshing(false));
	}, [open, onRefresh]);

	const refresh = (): void => {
		setRefreshing(true);
		void onRefresh().finally(() => setRefreshing(false));
	};

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
						onClick={refresh}
						disabled={refreshing}
						className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}
					>
						{refreshing ? t("ai.refreshing") : t("ai.refresh")}
					</button>
					<span className="flex-1" />
					<span className="text-[11px] text-muted-foreground">
						{providers.length > 0 ? t("ai.ready", { count: providers.length }) : denied ? t("ai.deniedShort") : t("ai.none")}
					</span>
				</div>
			}
		>
			<div className="space-y-3">
				<div>
					<span className={SECTION_LABEL}>{t("ai.mode.title")}</span>
					<div className="grid gap-1">
						{(
							[
								{ id: "local" as const, label: t("ai.mode.local"), hint: t("ai.mode.localHint") },
								{ id: "ai" as const, label: t("ai.mode.ai"), hint: t("ai.mode.aiHint") },
							]
						).map((option) => {
							const selected = mode === option.id;
							const unavailable = option.id === "ai" && providers.length === 0 && !denied;
							return (
								<button
									key={option.id}
									type="button"
									onClick={() => onChooseMode(option.id)}
									aria-pressed={selected}
									className={`${FOCUS_RING} flex w-full items-start justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
										selected ? "border-primary bg-primary/10" : "border-border hover:border-foreground/25"
									}`}
								>
									<span className="min-w-0">
										<span className="block truncate text-[12px] font-medium text-foreground">{option.label}</span>
										<span className="block text-[10px] leading-snug text-muted-foreground">
											{unavailable ? t("ai.mode.aiUnavailable") : option.hint}
										</span>
									</span>
									{selected ? (
										<svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
											<path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									) : null}
								</button>
							);
						})}
					</div>
				</div>

				{providers.length === 0 ? (
					<p
						className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
							denied ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-muted-foreground"
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
											className={`${FOCUS_RING} flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
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

				<p className="rounded-lg bg-muted/60 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
					{t("ai.cost")}
				</p>
				<p className="text-[11px] leading-relaxed text-muted-foreground">{t("ai.engineNote")}</p>
			</div>
		</ModalDialog>
	);
}
