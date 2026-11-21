import { useEffect, useState, type JSX } from "react";
import { buildBrandKit, paletteLines, type BrandKit } from "../../../domain/brand-kit";
import { renderLogo } from "../../../domain/engine/compose";
import type { DesignRecord } from "../../../domain/history-store";
import { previewUrl } from "../../../domain/render-png";
import { getPluginContext, reportError } from "../../../plugin-context";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from "../../../shared/styles/tokens";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import { saveKitFile, savePngFile, saveSvgFile } from "../services/export-files";

export interface BrandKitDialogProps {
	record: DesignRecord | null;
	onClose: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The brand kit, built on demand.
 *
 * Building it means rasterising seven PNGs, so it happens when the dialog opens
 * and not on every render; the stage label is what makes that wait legible.
 */
export function BrandKitDialog({ record, onClose, t }: BrandKitDialogProps): JSX.Element {
	const [kit, setKit] = useState<BrandKit | null>(null);
	const [stage, setStage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!record || record.engine !== "local") {
			setKit(null);
			return;
		}
		let alive = true;
		setKit(null);
		setError(null);
		setStage(t("kit.building"));
		buildBrandKit(record.spec, {
			onStage: (current) => {
				if (alive) setStage(current);
			},
		})
			.then((built) => {
				if (alive) {
					setKit(built);
					setStage(null);
				}
			})
			.catch((cause) => {
				if (!alive) return;
				setStage(null);
				setError(t("kit.failed"));
				reportError(t("kit.failed"), cause);
			});
		return () => {
			alive = false;
		};
	}, [record?.id, t]);

	const fs = () => getPluginContext().fs;

	const variants = record && record.engine === "local" ? renderLogo(record.spec) : null;
	const previews = variants
		? [
				{ id: "onLight", label: t("kit.onLight"), svg: variants.svg, bg: "#ffffff" },
				{ id: "onDark", label: t("kit.onDark"), svg: renderLogo({ ...record!.spec, surface: "dark" }).svg, bg: "#121210" },
				{ id: "mark", label: t("kit.mark"), svg: variants.markSvg, bg: "#f3f2ee" },
			]
		: [];

	return (
		<ModalDialog
			open={record !== null}
			onClose={onClose}
			title={t("kit.title")}
			description={record ? `${record.spec.brandName || t("kit.untitled")} · ${record.subject}` : undefined}
			size="wide"
			footer={
				<div className="flex flex-wrap items-center gap-1.5">
					<button
						type="button"
						disabled={!kit}
						onClick={() => kit && void saveKitFile(fs(), kit)}
						className={`${BUTTON_PRIMARY} ${FOCUS_RING}`}
					>
						{t("kit.downloadZip")}
					</button>
					<button
						type="button"
						disabled={!record || record.engine !== "local"}
						onClick={() => {
							if (!record || !variants) return;
							void saveSvgFile(fs(), record.spec, variants.svg);
						}}
						className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}
					>
						{t("kit.saveSvg")}
					</button>
					<button
						type="button"
						disabled={!record || record.engine !== "local"}
						onClick={() => {
							if (!record || !variants) return;
							void savePngFile(fs(), record.spec, variants.svg, 2048);
						}}
						className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}
					>
						{t("kit.savePng")}
					</button>
					<span className="flex-1" />
					{kit ? <span className="text-[10.5px] text-muted-foreground">{t("kit.fileCount", { count: kit.files.length })}</span> : null}
				</div>
			}
		>
			{record && record.engine !== "local" ? (
				<p className="rounded-lg bg-muted/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
					{t("kit.aiNote")}
				</p>
			) : null}

			{stage ? (
				<div className="flex items-center gap-2 py-6 text-[12px] text-muted-foreground">
					<span className="size-3 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
					{stage}
				</div>
			) : null}

			{error ? <p className="py-4 text-[12px] text-destructive">{error}</p> : null}

			{previews.length > 0 ? (
				<div className="grid grid-cols-3 gap-2">
					{previews.map((preview) => (
						<figure key={preview.id} className="m-0 overflow-hidden rounded-lg border border-border/60">
							<div className="aspect-square w-full" style={{ background: preview.bg }}>
								<img
									src={previewUrl(preview.svg)}
									alt={preview.label}
									className="size-full object-contain p-2"
									draggable={false}
								/>
							</div>
							<figcaption className="truncate px-2 py-1 text-[10px] text-muted-foreground">{preview.label}</figcaption>
						</figure>
					))}
				</div>
			) : null}

			{kit ? (
				<div className="mt-3 space-y-2">
					<div className="flex flex-wrap gap-1.5">
						{paletteLines(kit.palette).map((hex) => (
							<span
								key={hex}
								className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-foreground"
							>
								<span className="size-3 rounded-full ring-1 ring-inset ring-black/10" style={{ background: hex }} aria-hidden />
								{hex}
							</span>
						))}
					</div>
					<ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
						{kit.files.map((file) => (
							<li key={file.path} className="truncate" title={file.path}>
								{file.path}
							</li>
						))}
					</ul>
					<p className="text-[10.5px] leading-snug text-muted-foreground">{t("kit.guideHint")}</p>
				</div>
			) : null}
		</ModalDialog>
	);
}
