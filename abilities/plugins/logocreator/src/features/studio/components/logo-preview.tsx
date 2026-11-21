import { useEffect, useMemo, useState, type JSX } from "react";
import { renderLogo } from "../../../domain/engine/compose";
import type { DesignRecord } from "../../../domain/history-store";
import { previewUrl } from "../../../domain/render-png";
import { getPluginContext } from "../../../plugin-context";

/**
 * Resolves a design to something an `<img>` can load.
 *
 * Engine designs are re-rendered from their spec on demand — no image is stored,
 * so the preview is always the same bytes as the export. AI designs cannot be
 * re-derived, so they come from host blob storage; the URL is cached per blob id
 * because `getBlobRef` is an IPC round trip.
 */

const blobUrls = new Map<string, string>();

async function resolveBlobUrl(blobId: string): Promise<string | null> {
	const cached = blobUrls.get(blobId);
	if (cached) return cached;
	try {
		const ref = await getPluginContext().storage.getBlobRef(blobId);
		if (!ref?.url) return null;
		blobUrls.set(blobId, ref.url);
		return ref.url;
	} catch {
		return null;
	}
}

export interface LogoPreviewProps {
	record: DesignRecord;
	/** Extra classes for the `<img>`; sizing belongs to the caller. */
	className?: string;
	alt?: string;
}

export function LogoPreview({ record, className, alt }: LogoPreviewProps): JSX.Element {
	const localUrl = useMemo(
		() => (record.engine === "local" ? previewUrl(renderLogo(record.spec).svg) : null),
		[record.engine, record.spec],
	);
	const [aiUrl, setAiUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (record.engine !== "ai" || !record.blobId) return;
		let alive = true;
		void resolveBlobUrl(record.blobId).then((url) => {
			if (!alive) return;
			if (url) setAiUrl(url);
			else setFailed(true);
		});
		return () => {
			alive = false;
		};
	}, [record.engine, record.blobId]);

	const url = localUrl ?? aiUrl;

	if (failed) {
		return (
			<div className="flex size-full items-center justify-center bg-muted text-[11px] text-muted-foreground">
				Image unavailable
			</div>
		);
	}

	if (!url) {
		return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} aria-hidden />;
	}

	return (
		<img
			src={url}
			alt={alt ?? record.spec.brandName ?? "Logo"}
			className={className}
			draggable={false}
			loading="lazy"
		/>
	);
}

/** The SVG string for export, from the same renderer the preview used. */
export function recordSvg(record: DesignRecord): string | null {
	if (record.engine !== "local") return null;
	return renderLogo(record.spec).svg;
}
