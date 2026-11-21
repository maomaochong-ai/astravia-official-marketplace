import type { JSX } from "react";
import { CHIP, CHIP_ACTIVE, CHIP_IDLE, FOCUS_RING } from "../styles/tokens";

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
}

export interface SegmentedProps<T extends string> {
	value: T;
	options: readonly SegmentedOption<T>[];
	onChange: (value: T) => void;
	ariaLabel: string;
}

/** A row of mutually exclusive chips. Used for detail level and engine mode. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>): JSX.Element {
	return (
		<div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
			{options.map((option) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(option.value)}
						className={`${CHIP} ${FOCUS_RING} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
