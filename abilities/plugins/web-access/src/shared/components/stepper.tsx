interface StepperProps {
    "aria-label"?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    labels: { increase: string; decrease: string };
    onValueChange(value: number): void;
}

/**
 * 数值步进器。
 *
 * 上游把 `Stepper` 放在宿主设计系统（`@vetta-org/ui`）里；本仓库的
 * `@astravia-org/ui` 还没有这个组件，插件又不该等宿主发版才能装，
 * 所以留一份等价的本地实现：`data-slot="stepper"` 外壳 + 可直接键入的数字框 + 增减按钮。
 * 宿主补上之后删掉本文件、改回 import 即可。
 */
export function Stepper({ value, min, max, step = 1, labels, onValueChange, "aria-label": ariaLabel }: StepperProps) {
    const clamp = (next: number) => Math.min(max, Math.max(min, next));
    return (
        <div className="flex items-center gap-1" data-slot="stepper">
            <button
                type="button"
                className="size-7 rounded-md border border-border text-sm leading-none disabled:opacity-40"
                aria-label={labels.decrease}
                disabled={value <= min}
                onClick={() => onValueChange(clamp(value - step))}
            >
                −
            </button>
            <input
                type="number"
                className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-center text-sm tabular-nums"
                aria-label={ariaLabel}
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) onValueChange(clamp(next));
                }}
            />
            <button
                type="button"
                className="size-7 rounded-md border border-border text-sm leading-none disabled:opacity-40"
                aria-label={labels.increase}
                disabled={value >= max}
                onClick={() => onValueChange(clamp(value + step))}
            >
                +
            </button>
        </div>
    );
}
