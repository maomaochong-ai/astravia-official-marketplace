export interface DocTab {
	id: string;
	label: string;
	/** 悬停提示：通常是完整路径或标题。 */
	hint?: string;
}

export interface DocTabsProps {
	items: readonly DocTab[];
	value: string | null;
	onChange(id: string): void;
	/** 同一页面里可能有两组标签，给测试和定位留个把手。 */
	testId?: string;
}

/**
 * 一篇案例里的多份正文之间的切换条。
 *
 * 横向滚动而不是换行：证据条目一多，换行会把正文挤到屏幕外；标签只切「看哪一篇」，
 * 不改变已选的案例。
 */
export function DocTabs({ items, value, onChange, testId }: DocTabsProps) {
	if (items.length === 0) return null;
	return (
		<div data-testid={testId} className="fb-scroll flex gap-1 overflow-x-auto border-b border-line-subtle px-3 py-1.5">
			{items.map(item => {
				const active = item.id === value;
				return (
					<button
						key={item.id}
						type="button"
						data-doc-id={item.id}
						title={item.hint ?? item.id}
						aria-pressed={active}
						onClick={() => onChange(item.id)}
						className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
							active ? "border-line-strong bg-surface-4 text-text" : "border-transparent text-text-3 hover:bg-surface-hover hover:text-text"
						}`}
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}
