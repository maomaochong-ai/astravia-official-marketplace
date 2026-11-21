import type { JSX } from "react";
import type { DesignRecord } from "../../../domain/history-store";
import { formatRelativeTime } from "../../../shared/formatters/bytes";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import { LogoPreview } from "./logo-preview";

export interface LogoTileProps {
	record: DesignRecord;
	label: string;
	locale: string;
	selected: boolean;
	onSelect: () => void;
	onToggleFavorite: () => void;
	onSaveSvg: () => void;
	onSavePng: () => void;
	onOpenKit: () => void;
	onDelete: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}

function IconButton({
	label,
	onClick,
	children,
	active,
}: {
	label: string;
	onClick: () => void;
	children: JSX.Element;
	active?: boolean;
}): JSX.Element {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
			className={`flex size-6 items-center justify-center rounded-md transition-colors ${
				active ? "text-amber-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"
			}`}
		>
			{children}
		</button>
	);
}

/**
 * One design in the gallery.
 *
 * Clicking the artwork loads the design back into the form (so "tweak that one"
 * is one click), while the actions stay on the tile — an overflow menu inside a
 * 160 px card is worse than four small buttons.
 */
export function LogoTile({
	record,
	label,
	locale,
	selected,
	onSelect,
	onToggleFavorite,
	onSaveSvg,
	onSavePng,
	onOpenKit,
	onDelete,
	t,
}: LogoTileProps): JSX.Element {
	return (
		<figure className="group m-0 flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
			<button
				type="button"
				onClick={onSelect}
				aria-label={t("tile.load", { name: label })}
				title={t("tile.load", { name: label })}
				className={`${FOCUS_RING} relative block aspect-square w-full overflow-hidden bg-white`}
				style={record.spec.surface === "dark" ? { background: "#121210" } : undefined}
			>
				<LogoPreview
					record={record}
					alt={label}
					className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
				/>
				{selected ? (
					<span className="absolute inset-0 rounded-none ring-2 ring-inset ring-primary/70" aria-hidden />
				) : null}
				<span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90">
					{record.engine === "ai" ? "AI" : t("tile.local")}
				</span>
			</button>

			<figcaption className="flex flex-col gap-1 px-2 py-1.5">
				<div className="flex items-center justify-between gap-1">
					<span className="truncate text-[11.5px] font-medium text-foreground" title={`${label} · ${record.subject}`}>
						{label}
					</span>
					<span className="shrink-0 text-[9.5px] text-muted-foreground">
						{formatRelativeTime(record.createdAt, locale)}
					</span>
				</div>
				<div className="flex items-center gap-0.5">
					<IconButton label={t("tile.favorite")} active={record.favorite} onClick={onToggleFavorite}>
						<svg viewBox="0 0 24 24" className="size-3.5" fill={record.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" strokeLinejoin="round" />
						</svg>
					</IconButton>
					<IconButton label={t("tile.saveSvg")} onClick={onSaveSvg}>
						<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 17.5V19h14v-1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</IconButton>
					<IconButton label={t("tile.savePng")} onClick={onSavePng}>
						<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<rect x="4" y="5" width="16" height="14" rx="2" />
							<circle cx="9.5" cy="10" r="1.4" />
							<path d="M5 16.5l4-4 3 3 2.5-2.5 4.5 4.5" strokeLinejoin="round" />
						</svg>
					</IconButton>
					<IconButton label={t("tile.kit")} onClick={onOpenKit}>
						<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 8.5l8-3.5 8 3.5-8 3.5z" strokeLinejoin="round" />
							<path d="M4 12.5l8 3.5 8-3.5M4 16.5l8 3.5 8-3.5" strokeLinejoin="round" />
						</svg>
					</IconButton>
					<span className="flex-1" />
					<IconButton label={t("tile.delete")} onClick={onDelete}>
						<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M6 7h12M9.5 7V5.5h5V7M8 7l.7 11.5h6.6L16 7" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</IconButton>
				</div>
			</figcaption>
		</figure>
	);
}
