import { useMemo, useState, type JSX } from "react";
import type { DesignRecord } from "../../../domain/history-store";
import { formatRelativeTime } from "../../../shared/formatters/bytes";
import { BUTTON_SECONDARY, FOCUS_RING, INPUT } from "../../../shared/styles/tokens";
import { ModalDialog } from "../../../shared/components/modal-dialog";
import { IconStar, IconTrash } from "../../../shared/components/icons";

export interface HistorySheetProps {
	open: boolean;
	records: DesignRecord[];
	label: (record: DesignRecord) => string;
	locale: string;
	onClose: () => void;
	onSelect: (record: DesignRecord) => void;
	onToggleFavorite: (record: DesignRecord) => void;
	onDelete: (record: DesignRecord) => void;
	onClear: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}

type Filter = "all" | "favorites";

/**
 * The history list, with the two controls people actually use: search and
 * favourites. Delete is per-row and immediate — an undo for a logo you can
 * regenerate in one click is not worth a second modal.
 */
export function HistorySheet({
	open,
	records,
	label,
	locale,
	onClose,
	onSelect,
	onToggleFavorite,
	onDelete,
	onClear,
	t,
}: HistorySheetProps): JSX.Element {
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [confirmClear, setConfirmClear] = useState(false);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return records.filter((record) => {
			if (filter === "favorites" && !record.favorite) return false;
			if (!needle) return true;
			return (
				label(record).toLowerCase().includes(needle) ||
				record.spec.intent.toLowerCase().includes(needle) ||
				record.subject.toLowerCase().includes(needle)
			);
		});
	}, [records, query, filter, label]);

	return (
		<ModalDialog
			open={open}
			onClose={() => {
				setConfirmClear(false);
				onClose();
			}}
			title={t("history.title")}
			description={t("history.description", { count: records.length })}
			size="wide"
			footer={
				<div className="flex items-center gap-1.5">
					<span className="flex-1" />
					{confirmClear ? (
						<>
							<span className="text-[10.5px] text-muted-foreground">{t("history.clearConfirm")}</span>
							<button
								type="button"
								onClick={() => {
									onClear();
									setConfirmClear(false);
								}}
								className={`${BUTTON_SECONDARY} ${FOCUS_RING} text-destructive`}
							>
								{t("history.clearYes")}
							</button>
							<button type="button" onClick={() => setConfirmClear(false)} className={`${BUTTON_SECONDARY} ${FOCUS_RING}`}>
								{t("history.cancel")}
							</button>
						</>
					) : (
						<button
							type="button"
							disabled={records.length === 0}
							onClick={() => setConfirmClear(true)}
							className={`${BUTTON_SECONDARY} ${FOCUS_RING} text-destructive disabled:opacity-40`}
						>
							{t("history.clear")}
						</button>
					)}
				</div>
			}
		>
			<div className="mb-2 flex items-center gap-1.5">
				<input
					className={`${INPUT} h-8 flex-1 text-[12px]`}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("history.search")}
					aria-label={t("history.search")}
				/>
				<button
					type="button"
					onClick={() => setFilter(filter === "all" ? "favorites" : "all")}
					aria-pressed={filter === "favorites"}
					className={`${FOCUS_RING} h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${
						filter === "favorites" ? "border-amber-400 bg-amber-400/10 text-amber-600" : "border-border text-muted-foreground"
					}`}
				>
					{t("history.favorites")}
				</button>
			</div>

			{visible.length === 0 ? (
				<p className="py-6 text-center text-[11.5px] text-muted-foreground">{t("history.empty")}</p>
			) : (
				<ul className="divide-y divide-border/50">
					{visible.map((record) => (
						<li key={record.id} className="flex items-center gap-2 py-1.5">
							<button
								type="button"
								onClick={() => {
									onSelect(record);
									onClose();
								}}
								className={`${FOCUS_RING} flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted`}
							>
								<span className="min-w-0">
									<span className="block truncate text-[12px] font-medium text-foreground">{label(record)}</span>
									<span className="block truncate text-[10px] text-muted-foreground">
										{record.spec.style} · {record.spec.type} · {record.subject}
									</span>
								</span>
							</button>
							<span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(record.createdAt, locale)}</span>
							<button
								type="button"
								onClick={() => onToggleFavorite(record)}
								aria-pressed={record.favorite}
								aria-label={t("tile.favorite")}
								className={`${FOCUS_RING} flex size-6 items-center justify-center rounded-md ${
									record.favorite ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
								}`}
							>
								<IconStar filled={record.favorite} className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => onDelete(record)}
								aria-label={t("tile.delete")}
								className={`${FOCUS_RING} flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive`}
							>
								<IconTrash className="size-3.5" />
							</button>
						</li>
					))}
				</ul>
			)}
		</ModalDialog>
	);
}
