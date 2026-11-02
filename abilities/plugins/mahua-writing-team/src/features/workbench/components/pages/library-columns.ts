/**
 * 书库列的单一来源：档位边界、档位模板、每格从哪一档开始出现。
 *
 * 一条硬约束贯穿全文件：**每一档的轨道数必须等于该档还留着的格子数**。`display: grid`
 * 会把模板里已经没有列的多余子项塞进隐式第二行——行高翻倍、字被挤成两行，看起来像渲染错位。
 * 所以这里不是「模板一列、隐藏一列」两份各自维护，而是「格自带 `minWidth`，模板按同一档位
 * 从格数派生出来」：`tierCells(tier).length` 就是模板的轨道数，两者没有分开改的机会。
 * `test/manifest-guards.test.ts` 逐档核对这条等式。
 *
 * 档位按**实测宽度**判定，不按 CSS 断点：活动面板可以被拖到 260，也可以拉到窗口减 384，
 * 同一块屏幕下这两个宽度差着一整条侧栏。测量与分档在 `hooks/use-width-tier.ts`。
 *
 * 丢列的顺序按信息重要度：题材篇幅与字数 → 章数 → 更新；书名与阶段一直留着，
 * 它们是「哪本、到哪了」。台账的意义是横向比对，六列全挤在一行反而什么都比不了。
 *
 * 单独成文件而不是留在页面里，是因为守卫测试要 import 它——测试不该去正则解析 JSX。
 */

export type LibraryColumn = {
	/** 语言键：表头直接渲染它；行按同一个 key 分派单元格。 */
	key: string;
	/** 数字列右对齐一类只管外观的附加类。 */
	className: string;
	/** 行宽低于这个值时整格不渲染。0 = 任何宽度都留。 */
	minWidth: number;
};

/**
 * 五档的下界宽度（px），从宽到窄。下标与 `COLUMN_TEMPLATES` 对齐：
 * 0 = 六列，1 = 四列，2 = 三列，3 = 两列，4 = 只有书名。
 *
 * 最后一档是留给「面板被拖到窗口三分之一」的：`84px` 的阶段徽章不含在极窄宽度里，
 * 否则 `minmax(0,1fr)` 会缩到 0，书名一个字节的宽度都没有。
 */
export const COLUMN_BOUNDS = [1121, 821, 621, 421] as const;

/**
 * 六格，顺序即渲染顺序：书名 | 题材·篇幅 | 阶段 | 章数 | 字数 | 更新。
 *
 * `minWidth` 是「这一格从多宽开始才值得占地方」：题材与字数要 1121 才放得下，
 * 章数 821，更新 621，阶段徽章 421——徽章最窄但它是列表的主体信息，留到倒数第二档。
 */
export const LIBRARY_CELLS: readonly LibraryColumn[] = [
	{ key: "library.column.book", className: "", minWidth: 0 },
	{ key: "library.column.genreLength", className: "", minWidth: 1121 },
	{ key: "library.column.stage", className: "", minWidth: 421 },
	{ key: "library.column.chapters", className: "text-right", minWidth: 821 },
	{ key: "library.column.words", className: "text-right", minWidth: 1121 },
	{ key: "library.column.updated", className: "text-right", minWidth: 621 },
];

/**
 * 每档的 `grid-template-columns` 值（不是类名——宽度是量出来的，不交给 CSS 断点）。
 *
 * 宽度预算：固定列之和 420 / 228 / 156 / 84 / 0，间隙与内边距扣掉之后剩下的才是书名。
 * 书名那列永远是 `minmax(0,1fr)`：极端窄宽度下它先缩到 0，也不会把整行撑破——
 * 撑破的标志就是右边几列被推到看不见的地方。
 */
export const COLUMN_TEMPLATES = [
	"minmax(0,1fr) 124px 84px 72px 68px 72px",
	"minmax(0,1fr) 84px 72px 72px",
	"minmax(0,1fr) 84px 72px",
	"minmax(0,1fr) 84px",
	"minmax(0,1fr)",
] as const;

/** 某一档还留着哪些格。档位越窄，`minWidth` 越高，留下的越少。 */
export function tierCells(tier: number): LibraryColumn[] {
	const bound = COLUMN_BOUNDS[tier] ?? 0;
	return LIBRARY_CELLS.filter((cell) => bound >= cell.minWidth);
}

/** 某一档的列模板。档位越界时退回最窄一档，与 `useWidthTier` 的兜底一致。 */
export function tierTemplate(tier: number): string {
	return COLUMN_TEMPLATES[tier] ?? COLUMN_TEMPLATES[COLUMN_TEMPLATES.length - 1];
}
