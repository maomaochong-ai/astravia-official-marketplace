import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { renderLogo, resolveMark } from "../../../domain/engine/compose";
import type { DesignRecord } from "../../../domain/history-store";
import { kitSlug } from "../../../domain/brand-kit";
import { previewUrl } from "../../../domain/render-png";
import { getPluginContext, reportError } from "../../../plugin-context";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import { useCanvasNotes } from "../hooks/use-canvas-notes";
import { useDesignHistory } from "../hooks/use-design-history";
import { useGeneration } from "../hooks/use-generation";
import { useLogoForm } from "../hooks/use-logo-form";
import { savePngFile, saveSvgFile } from "../services/export-files";
import { claimPendingDesignId, onPendingDesignChanged, peekPendingDesignId } from "../pending-design";
import { publishCanvasSpec } from "../canvas-prompt";
import { AiSettingsDialog } from "./ai-settings-dialog";
import { BrandKitDialog } from "./brand-kit-dialog";
import { CanvasDock } from "./canvas-dock";
import { CanvasInspector } from "./canvas-inspector";
import { CanvasSurface } from "./canvas-surface";
import { HistorySheet } from "./history-sheet";
import { ResultGrid } from "./result-grid";

function Icon({ path }: { path: string }): JSX.Element {
	return (
		<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
			<path d={path} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * The tab: a canvas, not a form.
 *
 * Same anatomy as the reference design plugin, for the same reason — a 400–600 px
 * side panel has room for exactly one subject:
 *
 *   stage (fixed, fills)      · art, click-to-pin, pan-free single frame
 *   floating top-left         · brand + engine badge (title slot)
 *   floating top-right        · history / AI source / reset
 *   floating bottom dock      · generate · surprise · design panel · notes · kit
 *   right inspector           · the form or the notes list, as a rail
 *
 * The previous build was a single scrolling column: the canvas scrolled away under
 * a five-screen form, and the primary verb lived at the bottom of it. Nothing in
 * this file may reintroduce page-level scrolling — the stage is `flex-1 min-h-0`
 * and only the inspector scrolls.
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
	const [inspectorOpen, setInspectorOpen] = useState(false);
	const [inspectorTab, setInspectorTab] = useState<"design" | "notes">("design");

	const subject = useMemo(() => resolveMark(form.spec).subject, [form.spec]);
	// Typing stays at caret speed; the mark repaints on the next idle slot.
	const deferredSpec = useDeferredValue(form.spec);
	const preview = useMemo(() => previewUrl(renderLogo(deferredSpec).svg), [deferredSpec]);
	const canGenerate = Boolean(form.spec.brandName.trim()) || form.spec.type === "wordmark";
	const visibleNotes = notes.notes.filter((note) => note.designId === null || note.designId === selectedId);
	const pendingCount = visibleNotes.filter((note) => note.status === "pending").length;

	useEffect(() => {
		if (generation.lastCreatedId) setSelectedId(generation.lastCreatedId);
	}, [generation.lastCreatedId]);

	// A tool created a design while the panel was closed → show that one. Opening the
	// tab again must not clobber half-finished work, so only an empty form is seeded.
	const claimedRef = useRef<string | null>(null);
	const revealPending = useCallback(() => {
		const pendingId = claimPendingDesignId();
		if (!pendingId || claimedRef.current === pendingId) return;
		const record = history.items.find((item) => item.id === pendingId);
		if (!record) return;
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

	useEffect(() => onPendingDesignChanged(revealPending), [revealPending]);

	// Publish the open design so the composer chip can carry it into a prompt.
	useEffect(() => {
		publishCanvasSpec(form.spec);
	}, [form.spec]);

	const openInspector = (tab: "design" | "notes") => {
		setInspectorTab(tab);
		setInspectorOpen(true);
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

	const selectedRecord = selectedId ? history.items.find((item) => item.id === selectedId) : undefined;

	return (
		<div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
			{/* Stage — the canvas fills it; nothing here scrolls. */}
			<div className="relative min-h-0 flex-1">
				<div className="absolute inset-0 flex items-center justify-center p-4 pb-16">
					<div className="w-full max-w-[min(100%,34rem)]">
						<CanvasSurface
							previewUrl={preview}
							alt={t("panel.previewAlt")}
							notes={visibleNotes}
							dark={form.spec.surface === "dark"}
							onPlace={async (point, text) => notes.add({ designId: selectedId, text, ...point })}
						/>
					</div>
				</div>

				{/* Title slot, floating (reference: `absolute left-3 top-3`). */}
				<div className="absolute left-3 top-3 z-40 flex max-w-[calc(100%-5.5rem)] items-center gap-1.5">
					<span className="truncate rounded-md bg-popover/95 px-1.5 py-0.5 text-[12px] font-medium text-foreground shadow-sm ring-1 ring-border/60">
						{form.spec.brandName || t("canvas.untitled")}
					</span>
					<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
						{generation.mode === "ai" ? "AI" : t("panel.localBadge")}
					</span>
				</div>

				{/* Action rail, floating top-right. */}
				<div className="absolute right-2 top-2 z-40 flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover/95 p-0.5 shadow-sm">
					<button
						type="button"
						onClick={() => setHistoryOpen(true)}
						title={t("panel.history")}
						aria-label={t("panel.history")}
						className={`${FOCUS_RING} relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<Icon path="M12 8v4l3 2M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z" />
						{history.items.length > 0 ? (
							<span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary" aria-hidden />
						) : null}
					</button>
					<button
						type="button"
						onClick={() => setAiOpen(true)}
						title={t("panel.ai")}
						aria-label={t("panel.ai")}
						className={`${FOCUS_RING} flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<Icon path="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2l2.1 2.1m0-11.4l-2.1 2.1M8.4 15.6l-2.1 2.1" />
					</button>
					<button
						type="button"
						onClick={form.reset}
						title={t("panel.reset")}
						aria-label={t("panel.reset")}
						className={`${FOCUS_RING} flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
					>
						<Icon path="M4 10a8 8 0 1 1 2 5M4 5v5h5" />
					</button>
				</div>

				{/* Recent results, floating over the stage's lower edge — visible the
				    moment a run lands, without stealing the stage. */}
				{history.ready ? (
					<div className="absolute inset-x-0 bottom-16 z-20 px-3">
						<ResultGrid
							compact
							records={history.items.slice(0, 8)}
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
							emptyState={<span />}
						/>
					</div>
				) : null}

				<CanvasDock
					canGenerate={canGenerate}
					running={generation.running}
					mode={generation.mode}
					pendingNotes={pendingCount}
					inspectorOpen={inspectorOpen}
					inspectorTab={inspectorTab}
					onGenerate={() => void generation.generate(form.spec)}
					onSurprise={() => void generation.generate(form.spec, { surprise: true })}
					onOpenNotes={() => openInspector("notes")}
					onToggleInspector={() => (inspectorOpen ? setInspectorOpen(false) : openInspector("design"))}
					onOpenKit={() => {
						if (selectedRecord) setKitRecord(selectedRecord);
						else setInspectorOpen(true);
					}}
				/>

				<CanvasInspector
					open={inspectorOpen}
					tab={inspectorTab}
					onTab={setInspectorTab}
					onClose={() => setInspectorOpen(false)}
					controls={{
						spec: form.spec,
						previewSpec: deferredSpec,
						patch: form.patch,
						activePreset: form.activePreset,
						applyPreset: form.applyPreset,
						variations: generation.settings.variations,
						onVariations: generation.updateVariations,
						subject,
						aiMode: generation.mode === "ai",
						imageLabels: {
							fromImage: t("colour.fromImage"),
							imageFailed: t("error.imageRead"),
							tooLarge: t("error.imageTooLarge"),
						},
					}}
					notes={visibleNotes}
					onRemoveNote={(id) => void notes.remove(id)}
					onHandToAgent={() => void notes.handToAgent(selectedId, form.spec.brandName)}
					busy={generation.running}
				/>
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

			{/* Inline hint when a design cannot be generated yet (no toast: the state is
			    knowable before the click). */}
			{canGenerate ? null : (
				<p className="pointer-events-none absolute bottom-1 left-1/2 z-40 -translate-x-1/2 text-[10px] text-muted-foreground">
					{t("action.needName")}
				</p>
			)}
		</div>
	);
}

