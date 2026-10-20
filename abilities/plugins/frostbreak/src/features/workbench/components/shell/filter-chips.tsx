export interface FilterChip<T extends string> {
	id: T;
	label: string;
	count?: number;
}

export interface FilterChipsProps<T extends string> {
	items: readonly FilterChip<T>[];
	value: T;
	onChange(value: T): void;
}

/** 页内筛选 chip：一行小按钮，选中用前景色反差而不是彩色，避免和风险色抢注意力。 */
export function FilterChips<T extends string>({ items, value, onChange }: FilterChipsProps<T>) {
	return (
		<div className="fb-scroll flex min-w-0 items-center gap-1 overflow-x-auto">
			{items.map(item => {
				const active = item.id === value;
				return (
					<button
						key={item.id}
						type="button"
						onClick={() => onChange(item.id)}
						aria-pressed={active}
						className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${
							active ? "border-line-strong bg-surface-4 text-text" : "border-transparent text-text-4 hover:bg-surface-hover hover:text-text-2"
						}`}
					>
						{item.label}
						{typeof item.count === "number" ? <span className="ml-1 font-mono text-[10px] opacity-70">{item.count}</span> : null}
					</button>
				);
			})}
		</div>
	);
}
