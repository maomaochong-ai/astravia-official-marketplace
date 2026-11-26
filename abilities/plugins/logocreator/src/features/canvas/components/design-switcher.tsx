import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DesignDocumentRef } from "../../../domain/design-library";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import { IconVector } from "../../../shared/components/icons";

export interface DesignSwitcherProps {
	docs: readonly DesignDocumentRef[];
	/** 当前打开的那份（按目录比较）。 */
	current: string | null;
	onSelect(doc: DesignDocumentRef): void;
	/** 首次扫描还没回来。 */
	loading?: boolean;
	/** 重新扫一遍工作区。 */
	onRefresh?: () => void;
}

/**
 * 设计包切换器（自定义下拉）。
 *
 * 上一版用原生 `<select>`：列表由操作系统绘制，深色主题下是白底蓝选，和面板完全两个世界
 * （截图里那块突兀的白色）。原生下拉也无法给每项加图标与副标题，所以改成自绘 listbox：
 * 触发器用面板的 chip 样式，弹层用 popover 背景 + 主题色高亮。
 *
 * 标签只显示包名（`acme`）；只有当末段重名时才补一层父目录，避免把 `tmp/brand` 这种
 * 临时路径直接摆到用户面前。
 */
export function DesignSwitcher({ docs, current, onSelect, loading = false, onRefresh }: DesignSwitcherProps): JSX.Element | null {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (event: MouseEvent): void => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	if (!loading && docs.length === 0) return null;

	// 末段重名时才显示父目录：正常情况下只给包名。
	const segments = docs.map((doc) => doc.folder.split("/").filter(Boolean));
	const shortNames = segments.map((parts) => parts.at(-1)?.replace(/\.logocreator-design$/u, "") ?? "");
	const duplicated = new Set(shortNames.filter((name, index) => shortNames.indexOf(name) !== index));
	const labelOf = (doc: DesignDocumentRef, index: number): string => {
		const short = shortNames[index] ?? doc.slug;
		if (!duplicated.has(short)) return short;
		const parent = segments[index]?.at(-2);
		return parent ? `${parent}/${short}` : short;
	};

	const activeIndex = docs.findIndex((doc) => doc.folder === current);
	const activeLabel = activeIndex >= 0 ? labelOf(docs[activeIndex]!, activeIndex) : null;

	return (
		<div ref={rootRef} className="relative flex min-w-0 items-center gap-1">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-haspopup="listbox"
				aria-expanded={open}
				data-testid="design-switcher"
				title={activeLabel ?? t("design.switcherHint", { count: docs.length })}
				className={`${FOCUS_RING} flex min-w-0 items-center gap-1 rounded-md bg-popover px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/60 hover:bg-accent`}
			>
				<IconVector className="size-3 shrink-0 text-muted-foreground" />
				<span className="sr-only">{t("design.switcher")}</span>
				<span className="min-w-0 max-w-[10rem] truncate">
					{loading && docs.length === 0
						? t("design.switcherLoading")
						: (activeLabel ?? t("design.switcherCurrent"))}
				</span>
				<span aria-hidden className="shrink-0 text-[9px] text-muted-foreground">
					▾
				</span>
			</button>

			{open ? (
				<ul
					role="listbox"
					aria-label={t("design.switcher")}
					className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
				>
					{docs.map((doc, index) => {
						const active = doc.folder === current;
						return (
							<li key={doc.folder}>
								<button
									type="button"
									role="option"
									aria-selected={active}
									onClick={() => {
										setOpen(false);
										onSelect(doc);
									}}
									title={doc.path}
									className={`${FOCUS_RING} flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors ${
										active ? "bg-primary/12 text-primary" : "text-foreground hover:bg-muted"
									}`}
								>
									<IconVector className="size-3 shrink-0 opacity-70" />
									<span className="min-w-0 flex-1 truncate">{labelOf(doc, index)}</span>
									{active ? <span aria-hidden className="shrink-0 text-[9px]">✓</span> : null}
								</button>
							</li>
						);
					})}
					{onRefresh ? (
						<li className="border-t border-border/60 pt-1">
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									onRefresh();
								}}
								className={`${FOCUS_RING} flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground`}
							>
								<span aria-hidden className="icon-[lucide--refresh-cw] size-3" />
								{t("design.switcherRefresh")}
							</button>
						</li>
					) : null}
				</ul>
			) : null}
		</div>
	);
}
