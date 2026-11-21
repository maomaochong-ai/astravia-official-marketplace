import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { renderLogo, resolveMark } from "../../../domain/engine/compose";
import type { DesignRecord } from "../../../domain/history-store";
import { kitSlug } from "../../../domain/brand-kit";
import { previewUrl } from "../../../domain/render-png";
import { getPluginContext, reportError } from "../../../plugin-context";
import { BUTTON_PRIMARY, FOCUS_RING } from "../../../shared/styles/tokens";
import { useDesignHistory } from "../hooks/use-design-history";
import { useGeneration } from "../hooks/use-generation";
import { useLogoForm } from "../hooks/use-logo-form";
import { savePngFile, saveSvgFile } from "../services/export-files";
import { AiSettingsDialog } from "./ai-settings-dialog";
import { BrandKitDialog } from "./brand-kit-dialog";
import { HistorySheet } from "./history-sheet";
import { ResultGrid } from "./result-grid";
import { CanvasControls } from "./canvas-controls";
import { CanvasToolbar } from "./canvas-toolbar";
import { claimPendingDesignId, onPendingDesignChanged, peekPendingDesignId } from "../pending-design";
import { useCanvasNotes } from "../hooks/use-canvas-notes";
import { CanvasNotesLayer } from "./canvas-notes-layer";
import { publishCanvasSpec } from "../canvas-prompt";

function Icon({ path }: { path: string }): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
			<path d={path} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * The activity-panel surface: form on top, gallery below.
 *
 * A single column, because the panel is 400–600 px wide and a two-column layout
 * here would leave neither half usable. The form scrolls with the gallery rather
 * than pinning itself, so the newest result is never hidden behind a fixed header.
 */
export function LogoCanvas(): JSX.Element {
	const { t, locale } = useTranslation();
	const form = useLogoForm();
	const history = useDesignHistory({
		saveFailed: t("error.historyLoad"),
		updateFailed: t("error.historyUpdate"),
		removeFailed: t("error.historyRemove"),
		clearFailed: t("error.historyClear"),
	});
	const generation = useGeneration({
		aiUnavailable: t("notify.aiUnavailable"),
		aiFailed: t("notify.aiFailed"),
		localFailed: t("notify.localFailed"),
		aiDone: (count) => t("notify.aiDone", { count }),
		aiPartial: (failed) => t("notify.aiPartial", { failed }),
	});

	const notes = useCanvasNotes({
		sendFailed: t("error.notesSend"),
		addFailed: t("error.notesAdd"),
		removeFailed: t("error.notesRemove"),
	});

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [kitRecord, setKitRecord] = useState<DesignRecord | null>(null);
	const [aiOpen, setAiOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);

	const subject = useMemo(() => resolveMark(form.spec).subject, [form.spec]);

	// Keeping the newest result selected makes "generate → save" a straight line.
	useEffect(() => {
		if (generation.lastCreatedId) setSelectedId(generation.lastCreatedId);
	}, [generation.lastCreatedId]);

	// Two ways a design can arrive while this panel is not the active one, and they
	// need different treatment:
	//  - a **tool** just created it → the user is waiting to see *that* one, so it is
	//    claimed and loaded, replacing whatever the form held;
	//  - this is just the panel opening again → only seed an empty form, because
	//    overwriting half-finished work with the last saved design is worse than
	//    showing nothing.
	const claimedRef = useRef<string | null>(null);
	const revealPending = useCallback(() => {
		const pendingId = claimPendingDesignId();
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) {
			// The tool wrote to storage; this panel hydrated before that landed.
			// Re-render when the store catches up.
			return;
		}
		claimedRef.current = pendingId;
		form.load(record.spec);
		setSelectedId(record.id);
	}, [history.items, form]);

	useEffect(() => {
		if (!history.ready) return;
		if (peekPendingDesignId()) {
			revealPending();
			return;
		}
		if (form.spec.brandName) return;
		const latest = history.items[0];
		if (latest) {
			form.load(latest.spec);
			setSelectedId(latest.id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [history.ready, history.items.length]);

	// A tool call can land while the panel is already open: the store notifies, or
	// the pending id changes without a store write (a second run in the same turn).
	useEffect(() => onPendingDesignChanged(revealPending), [revealPending]);

	// Publish the open design so the composer toggle can carry it into a prompt.
	useEffect(() => {
		publishCanvasSpec(form.spec);
	}, [form.spec]);

	// The preview follows the *deferred* spec: typing stays at caret speed while the
	// mark repaints on React's next idle slot.
	const deferredSpec = useDeferredValue(form.spec);
	const preview = useMemo(() => previewUrl(renderLogo(deferredSpec).svg), [deferredSpec]);

	const handleGenerate = async () => {
		if (!form.spec.brandName.trim() && form.spec.type !== "wordmark") {
			getPluginContext().ui.notify({ message: t("notify.needName"), variant: "warning" });
			return;
		}
		await generation.generate(form.spec);
	};

	const handleSaveSvg = (record: DesignRecord) => {
		const ctx = getPluginContext();
		if (record.engine === "local") {
			void saveSvgFile(ctx.fs, record.spec, renderLogo(record.spec).svg).then((path) => {
				if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
			});
			return;
		}
		ctx.ui.notify({ message: t("notify.aiSvgUnavailable"), variant: "info" });
	};

	const handleSavePng = async (record: DesignRecord) => {
		const ctx = getPluginContext();
		if (record.engine === "local") {
			const path = await savePngFile(ctx.fs, record.spec, renderLogo(record.spec).svg, 2048);
			if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
			return;
		}
		if (!record.blobId) return;
		try {
			const blob = await ctx.storage.readBlob(record.blobId);
			if (!blob) throw new Error("The stored image is missing");
			const path = await ctx.fs.saveAs(`${kitSlug(record.spec)}-ai.png`, blob.data, "base64", {
				title: t("tile.savePng"),
				filters: [{ name: "PNG", extensions: ["png"] }],
			});
			if (path) ctx.ui.notify({ message: t("notify.saved", { path }), variant: "success" });
		} catch (cause) {
			reportError(t("notify.saveFailed"), cause);
		}
	};

	return (
		<div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
			<CanvasToolbar
				title={t("panel.title")}
				subtitle={t("panel.subtitle")}
				engineBadge={generation.mode === "ai" ? "AI" : t("panel.localBadge")}
				actions={[
					{
						id: "history",
						label: t("panel.history"),
						icon: <Icon path="M12 8v4l3 2M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z" />,
						onClick: () => setHistoryOpen(true),
					},
					{
						id: "ai",
						label: t("panel.ai"),
						icon: <Icon path="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2l2.1 2.1m0-11.4l-2.1 2.1M8.4 15.6l-2.1 2.1" />,
						onClick: () => setAiOpen(true),
					},
					{
						id: "reset",
						label: t("panel.reset"),
						icon: <Icon path="M4 10a8 8 0 1 1 2 5M4 5v5h5" />,
						onClick: form.reset,
					},
				]}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
				<div className="mb-3">
					<CanvasNotesLayer
						previewUrl={preview}
						alt={t("panel.previewAlt")}
						notes={notes.notes.filter((note) => note.designId === null || note.designId === selectedId)}
						dark={form.spec.surface === "dark"}
						onPlace={async (point, noteText) => notes.add({ designId: selectedId, text: noteText, ...point })}
						onRemove={(id) => void notes.remove(id)}
					/>
				</div>

				<CanvasControls
					spec={form.spec}
					previewSpec={deferredSpec}
					patch={form.patch}
					activePreset={form.activePreset}
					applyPreset={form.applyPreset}
					variations={generation.settings.variations}
					onVariations={generation.updateVariations}
					subject={subject}
					aiMode={generation.mode === "ai"}
					imageLabels={{
						fromImage: t("colour.fromImage"),
						imageFailed: t("error.imageRead"),
						tooLarge: t("error.imageTooLarge"),
					}}
				/>

				<div className="mt-3 flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => void handleGenerate()}
						disabled={generation.running}
						className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-10 flex-1 text-[13px]`}
					>
						{generation.running ? t("action.working") : generation.mode === "ai" ? t("action.generateAi") : t("action.generate")}
					</button>
					<button
						type="button"
						onClick={() => void notes.handToAgent(selectedId, form.spec.brandName)}
						disabled={generation.running || notes.notes.filter((note) => note.status === "pending").length === 0}
						title={t("notes.handToAgent")}
						aria-label={t("notes.handToAgent")}
						className={`${FOCUS_RING} flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40`}
					>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 6.5h16M4 12h10M4 17.5h7" strokeLinecap="round" />
							<path d="M16.5 15.5l2 2 3-3.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
					<button
						type="button"
						onClick={() => void generation.generate(form.spec, { surprise: true })}
						disabled={generation.running}
						title={t("action.surprise")}
						aria-label={t("action.surprise")}
						className={`${FOCUS_RING} flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50`}
					>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 8.5l2.5 2.5L9 8.5 6.5 6zM15 8.5L17.5 11 20 8.5 17.5 6zM4 17l2.5 2.5L9 17l-2.5-2.5zM15 17l2.5 2.5L20 17l-2.5-2.5z" strokeLinejoin="round" />
							<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
						</svg>
					</button>
				</div>

				<div className="mt-4 flex items-center justify-between">
					<span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
						{t("gallery.title")}
					</span>
					{history.items.length > 0 ? (
						<button
							type="button"
							onClick={() => setHistoryOpen(true)}
							className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground"
						>
							{t("gallery.viewAll", { count: history.items.length })}
						</button>
					) : null}
				</div>

				<div className="mt-2">
					<ResultGrid
						records={history.items.slice(0, 24)}
						ready={history.ready}
						selectedId={selectedId}
						locale={locale}
						label={history.label}
						onSelect={(record) => {
							form.load(record.spec);
							setSelectedId(record.id);
						}}
						onToggleFavorite={(record) => void history.setFavorite(record.id, !record.favorite)}
						onSaveSvg={handleSaveSvg}
						onSavePng={(record) => void handleSavePng(record)}
						onOpenKit={setKitRecord}
						onDelete={(record) => void history.remove(record.id)}
						t={t}
						emptyState={
							<div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
								<p className="text-[12px] font-medium text-foreground">{t("empty.title")}</p>
								<p className="mx-auto mt-1 max-w-[16rem] text-[11px] leading-relaxed text-muted-foreground">
									{t("empty.body")}
								</p>
							</div>
						}
					/>
				</div>
			</div>

			<BrandKitDialog record={kitRecord} onClose={() => setKitRecord(null)} t={t} />

			<HistorySheet
				open={historyOpen}
				records={history.items}
				label={history.label}
				locale={locale}
				onClose={() => setHistoryOpen(false)}
				onSelect={(record) => {
					form.load(record.spec);
					setSelectedId(record.id);
				}}
				onToggleFavorite={(record) => void history.setFavorite(record.id, !record.favorite)}
				onDelete={(record) => void history.remove(record.id)}
				onClear={() => void history.clear()}
				t={t}
			/>

			<AiSettingsDialog
				open={aiOpen}
				settings={generation.settings}
				providers={generation.providers}
				denied={generation.aiDenied}
				onClose={() => setAiOpen(false)}
				onChooseProvider={(providerId) => {
					generation.updateSettings({ providerId });
					generation.setMode(providerId ? "ai" : "local");
				}}
				onRefresh={generation.refreshProviders}
				t={t}
			/>
		</div>
	);
}
