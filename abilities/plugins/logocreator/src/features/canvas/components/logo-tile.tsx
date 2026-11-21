import type { JSX } from "react";
import type { DesignRecord } from "../../../domain/history-store";
import { formatRelativeTime } from "../../../shared/formatters/bytes";
import { IconCopy, IconPalette, IconStar, IconTrash, IconVector } from "../../../shared/components/icons";
import { FOCUS_RING, NOTE_STAR } from "../../../shared/styles/tokens";
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
				active ? NOTE_STAR : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
					<span className="truncate text-[12px] font-medium text-foreground" title={`${label} · ${record.subject}`}>
						{label}
					</span>
					<span className="shrink-0 text-[10px] text-muted-foreground">
						{formatRelativeTime(record.createdAt, locale)}
					</span>
				</div>
				<div className="flex items-center gap-0.5">
					<IconButton label={t("tile.favorite")} active={record.favorite} onClick={onToggleFavorite}>
						<IconStar filled={record.favorite} className="size-3.5" />
					</IconButton>
					<IconButton label={t("tile.saveSvg")} onClick={onSaveSvg}>
						<IconVector className="size-3.5" />
					</IconButton>
					<IconButton label={t("tile.savePng")} onClick={onSavePng}>
						<IconCopy className="size-3.5" />
					</IconButton>
					<IconButton label={t("tile.kit")} onClick={onOpenKit}>
						<IconPalette className="size-3.5" />
					</IconButton>
					<span className="flex-1" />
					<IconButton label={t("tile.delete")} onClick={onDelete}>
						<IconTrash className="size-3.5" />
					</IconButton>
				</div>
			</figcaption>
		</figure>
	);
}
