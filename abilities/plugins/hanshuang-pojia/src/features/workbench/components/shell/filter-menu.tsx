import { useRef } from "react";
import { Icon } from "./icon";

export interface FilterMenuItem<T extends string> {
	id: T;
	label: string;
	count?: number;
}

export interface FilterMenuProps<T extends string> {
	/** 未选中时显示的文案（如「筛选」）。 */
	placeholder: string;
	items: readonly FilterMenuItem<T>[];
	value: T | null;
	onChange(value: T | null): void;
	/** 全部条目 id；与它为同值时视为未筛选。 */
	allId: T;
	/** 选完自动收起；组件内部用 `<details>`，不需要调用方管开关状态。 */
	label?: string;
}

/**
 * 筛选下拉：文档页与案例库**同一个控件**。
 *
 * 之前两页各有一套：文档是 `<details>` 下拉，案例库是一排 chip。同一栏里两种形态，
 * 用户读不出它们是同一件事（筛同一份清单），而且 chip 在窄面板下会横滚、把计数挤掉。
 * 现在统一成这里的一件：折叠态是一枚小胶囊（图标 + 当前筛选名），展开是带计数的清单。
 *
 * `<details>` 不会因为内部点击自动收起，所以每个选项自己关一次——这是原生元素唯一
 * 需要手动补的行为。
 */
export function FilterMenu<T extends string>({
	placeholder,
	items,
	value,
	onChange,
	allId,
	label,
}: FilterMenuProps<T>) {
	const ref = useRef<HTMLDetailsElement | null>(null);
	const close = () => {
		if (ref.current) ref.current.open = false;
	};
	const active = value === null || value === allId ? null : items.find(item => item.id === value);
	const isFiltered = active !== null;

	return (
		<details ref={ref} className="fb-menu relative shrink-0">
			<summary
				title={label}
				className={`flex cursor-pointer list-none items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ${
					isFiltered ? "border-accent/40 bg-accent-soft text-accent" : "border-line-subtle text-text-2 hover:bg-surface-hover"
				}`}
			>
				<Icon name="filter" className="size-3" />
				<span className="max-w-[160px] fb-wrap">{active ? active.label : placeholder}</span>
			</summary>
			<div className="absolute end-0 top-full z-30 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-lg bg-surface-2 p-1 shadow-lg ring-1 ring-line-strong">
				{items.map(item => {
					const selected = item.id === value || (item.id === allId && value === null);
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => {
								// 再点一次已选项 = 取消筛选，回到「全部」。
								onChange(selected && item.id !== allId ? allId : item.id);
								close();
							}}
							className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11.5px] ${
								selected ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover"
							}`}
						>
							<span className="min-w-0 flex-1 fb-wrap">{item.label}</span>
							{typeof item.count === "number" ? (
								<span className="font-mono text-[9.5px] text-text-4">{item.count}</span>
							) : null}
						</button>
					);
				})}
			</div>
		</details>
	);
}
