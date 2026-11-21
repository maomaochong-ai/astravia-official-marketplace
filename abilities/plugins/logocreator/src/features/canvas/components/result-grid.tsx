import type { JSX } from "react";
import type { DesignRecord } from "../../../domain/history-store";
import { LogoPreview } from "./logo-preview";
import { LogoTile } from "./logo-tile";

export interface ResultGridProps {
	records: DesignRecord[];
	ready: boolean;
	selectedId: string | null;
	locale: string;
	label: (record: DesignRecord) => string;
	onSelect: (record: DesignRecord) => void;
	onToggleFavorite: (record: DesignRecord) => void;
	onSaveSvg: (record: DesignRecord) => void;
	onSavePng: (record: DesignRecord) => void;
	onOpenKit: (record: DesignRecord) => void;
	onDelete: (record: DesignRecord) => void;
	/** Shown instead of the grid when there is nothing yet. */
	emptyState: JSX.Element;
	/** Horizontal rail of small tiles, for the space over the canvas stage. */
	compact?: boolean;
	t: (key: string, params?: Record<string, string | number>) => string;
}

export function ResultGrid({
	records,
	ready,
	selectedId,
	locale,
	label,
	onSelect,
	onToggleFavorite,
	onSaveSvg,
	onSavePng,
	onOpenKit,
	onDelete,
	emptyState,
	compact = false,
	t,
}: ResultGridProps): JSX.Element {
	if (!ready) {
		return (
			<div className="grid grid-cols-2 gap-2" aria-busy>
				{Array.from({ length: 4 }, (_, index) => (
					<div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-muted/60" />
				))}
			</div>
		);
	}

	if (records.length === 0) return emptyState;

	if (compact) {
		return (
			<div
				className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				role="list"
			>
				{records.map((record) => (
					<button
						key={record.id}
						type="button"
						role="listitem"
						onClick={() => onSelect(record)}
						title={label(record)}
						aria-label={label(record)}
						className={`relative size-14 shrink-0 overflow-hidden rounded-lg border bg-white transition-transform hover:scale-[1.03] ${
							record.id === selectedId ? "border-primary ring-2 ring-primary/40" : "border-border/60"
						}`}
						style={record.spec.surface === "dark" ? { background: "#121210" } : undefined}
					>
						<LogoPreview record={record} alt={label(record)} className="size-full object-contain" />
						{record.favorite ? (
							<span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500" aria-hidden />
						) : null}
					</button>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-2" role="list">
			{records.map((record) => (
				<div role="listitem" key={record.id}>
					<LogoTile
						record={record}
						label={label(record)}
						locale={locale}
						selected={record.id === selectedId}
						onSelect={() => onSelect(record)}
						onToggleFavorite={() => onToggleFavorite(record)}
						onSaveSvg={() => onSaveSvg(record)}
						onSavePng={() => onSavePng(record)}
						onOpenKit={() => onOpenKit(record)}
						onDelete={() => onDelete(record)}
						t={t}
					/>
				</div>
			))}
		</div>
	);
}
