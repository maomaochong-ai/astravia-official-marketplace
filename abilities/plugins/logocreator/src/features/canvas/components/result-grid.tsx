import type { JSX } from "react";
import type { DesignRecord } from "../../../domain/history-store";
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
