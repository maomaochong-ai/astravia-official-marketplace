/**
 * 书库列的单一来源：列模板、隐藏档位、表头顺序。
 *
 * 台账表的麻烦在于「列数会变、单元格数不变」——`display: grid` 会把模板里已经没有列的
 * 多余子项塞进隐式第二行：行高翻倍、字被挤成两行，看起来像渲染错位。所以每一档模板的
 * 轨道数必须**等于**该档还留着的单元格数。这句话在这里是可执行的：`COLUMNS_TIERS` 给出
 * 轨道数，`HEADER_CELLS` 给出每格从哪一档开始隐藏，`visibleHeaderCells()` 把两者对起来，
 * `test/manifest-guards.test.ts` 逐档核对。
 *
 * 第二条同样重要：**每档的宽度必须与「该档还留着的那几格」一一对上**。模板是按
 * `HEADER_CELLS` 的顺序从左到右铺的，丢列只会从右端或中间整块丢，所以模板里剩下的宽度
 * 依次属于剩下的格。写完一档就默念一遍「这一串 px 分别是谁的」，否则会出现阶段徽章被塞进
 * 72px、书名的 `1fr` 反而被挤成 0 的那种错位。
 *
 * 丢列的顺序按信息重要度：题材篇幅与字数 → 章数 → 更新；书名与阶段一直留着，
 * 它们是「哪本、到哪了」。台账的意义是横向比对，六列全挤在一行反而什么都比不了。
 *
 * 档位按**容器**宽度（最近的 `@container` 是工作台外壳），不是窗口宽度：活动面板可以被拖到
 * 260，也可以拉到窗口减 384，同一块屏幕下这两个宽度差着一整条侧栏。
 *
 * 单独成文件而不是留在页面里，是因为守卫测试要 import 它——测试不该去正则解析 JSX。
 */
export const HIDE_GENRE = "@max-[1120px]:hidden"; // 题材·篇幅 / 字数
export const HIDE_CHAPTERS = "@max-[820px]:hidden"; // 章数
export const HIDE_UPDATED = "@max-[620px]:hidden"; // 更新

/**
 * 四档列模板。`tracks` 是该档保留的列数，`template` 是 Tailwind 类串，两者必须一致——
 * 改模板就顺手改 `tracks`，守卫会拦住只改一边的那种。
 *
 * 宽度预算（每档固定列之和 + 间隙 + 内边距之后剩下的才是书名）：
 * 六列 420、四列 228、三列 156、两列 84。书名那一列永远 `minmax(0,1fr)`，
 * 让它在极端窄宽度下先缩到 0 也不会把整行撑破——撑破的标志就是右边几列被推到看不见的地方。
 */
export const COLUMNS_TIERS = [
	{ tracks: 6, template: "grid-cols-[minmax(0,1fr)_124px_84px_72px_68px_72px]" },
	{ tracks: 4, template: "@max-[1120px]:grid-cols-[minmax(0,1fr)_84px_72px_72px]" },
	{ tracks: 3, template: "@max-[820px]:grid-cols-[minmax(0,1fr)_84px_72px]" },
	{ tracks: 2, template: "@max-[620px]:grid-cols-[minmax(0,1fr)_84px]" },
] as const;

/** 表头与行共用的列类串。 */
export const COLUMNS = COLUMNS_TIERS.map((tier) => tier.template).join(" ");

export type LibraryColumn = {
	/** 语言键：表头直接渲染它。 */
	key: string;
	/** 数字列右对齐一类只管外观的附加类。 */
	className: string;
	/** 列数降到这个值时这一格开始隐藏；`null` = 任何宽度都留。 */
	hiddenAt: number | null;
};

/**
 * 表头六格，顺序必须与每档模板的轨道顺序一致：
 * 书名 | 题材·篇幅 | 阶段 | 章数 | 字数 | 更新。
 */
export const HEADER_CELLS: LibraryColumn[] = [
	{ key: "library.column.book", className: "", hiddenAt: null },
	{ key: "library.column.genreLength", className: "", hiddenAt: 4 },
	{ key: "library.column.stage", className: "", hiddenAt: null },
	{ key: "library.column.chapters", className: "text-right", hiddenAt: 3 },
	{ key: "library.column.words", className: "text-right", hiddenAt: 4 },
	{ key: "library.column.updated", className: "text-right", hiddenAt: 2 },
];

/**
 * 某一档还能看见哪些格。隐藏是**累积**的：`@max-` 档位一旦命中就一直命中，
 * 所以 `hiddenAt`（开始隐藏的那一档）小于等于当前档位时要一起算进去。
 * 守卫用它核对 `COLUMNS_TIERS[i].tracks`。
 */
export function visibleHeaderCells(tracks: number): LibraryColumn[] {
	return HEADER_CELLS.filter((cell) => cell.hiddenAt === null || tracks > cell.hiddenAt);
}

function hideClassFor(tracks: number): string {
	if (tracks === 4) return HIDE_GENRE;
	if (tracks === 3) return HIDE_CHAPTERS;
	if (tracks === 2) return HIDE_UPDATED;
	return "";
}

/** 一格该挂哪些类：外观 + 该档隐藏。行与表头都从这里取，免得两处各写一份。 */
export function columnClassName(cell: LibraryColumn): string {
	const hide = cell.hiddenAt === null ? "" : hideClassFor(cell.hiddenAt);
	return [cell.className, hide].filter(Boolean).join(" ");
}
