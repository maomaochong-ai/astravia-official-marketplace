import type { JSX } from "react";
import type { ReviewCategory } from "../../../review/finding.ts";
import { CATEGORY_LABEL } from "../finding-view.ts";

/** 类别标签一律中性色：它说明「哪一类问题」，不承担紧急度信号。 */
export function CategoryTag({ category }: { category: ReviewCategory }): JSX.Element {
	return (
		<span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
			{CATEGORY_LABEL[category]}
		</span>
	);
}
