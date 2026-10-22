export interface NumberFieldProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	hint?: string;
	onChange(value: number): void;
}

/** 设置页的数字输入；夹在 min/max 之间，非法输入回到原值。 */
export function NumberField({ label, value, min, max, step = 1, hint, onChange }: NumberFieldProps) {
	return (
		<label className="flex items-start gap-3 px-3.5 py-2.5">
			<span className="min-w-0 flex-1">
				<span className="block text-[12px] text-text">{label}</span>
				{hint ? <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-4">{hint}</span> : null}
			</span>
			<input
				type="number"
				inputMode="numeric"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={event => {
					const next = Number(event.target.value);
					if (!Number.isFinite(next)) return;
					onChange(Math.min(max, Math.max(min, Math.round(next))));
				}}
				className="w-16 shrink-0 rounded border border-line bg-surface px-1.5 py-1 text-right font-mono text-[11.5px] text-text outline-none focus:border-line-strong"
			/>
		</label>
	);
}
