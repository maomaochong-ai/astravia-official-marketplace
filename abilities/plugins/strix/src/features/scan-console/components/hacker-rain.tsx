/**
 * 下落的代码背景（ADR 0011 的「数据流」，1.0.2 加密并铺到工作台）。
 *
 * 三个决定，都是为了它不干扰阅读：
 *
 * 1. **固定字符集**，不用 `Math.random()`：截图与测试可复现，且每次刷新看到同一幅图，
 *    不会让人觉得"界面在抖"。
 * 2. **纯 CSS 动画**（`translateY` + 逐列不同时长/延迟）：不占主线程，不与滚动和 resize 抢帧。
 * 3. **密度由列数控制**，两处取值不同：首屏是主角（密），工作台是背景（更密但更淡）——
 *    工作台上永远压着命令与输出，所以靠 `data-density` 把不透明度再压一档。
 *
 * 无障碍：`prefers-reduced-motion` 下所有列静止（style.css），且整体 `aria-hidden`——
 * 它是装饰，不该被读屏念出来。
 */

/** 字形：0/1 + 半角片假名 + 符号。上游 splash 没有这个背景，这是本插件的加法。 */
const GLYPHS = "01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ$#%&*+=<>{}[]|/\\";

export interface HackerRainProps {
	/** `splash`：首屏，较疏但更亮；`workbench`：工作台，更密但更淡。 */
	density?: "splash" | "workbench";
}

/** 列数：工作台比首屏更密（用户反馈首屏不够密，两处一起提上来）。 */
const COLUMNS: Record<NonNullable<HackerRainProps["density"]>, number> = {
	splash: 46,
	workbench: 58,
};

/** 每列的字数：够长才能让"下落"看起来连续，而不是几颗字符在飘。 */
const ROWS = 34;

/**
 * 生成一列。
 *
 * 用 `(column * 7 + row * 3) % len` 这种确定性取字符：同一列每次渲染都一样，
 * 列与列之间仍然错开（7 与 3 互质，周期覆盖整个字符集）。
 */
function column(seed: number): string {
	let text = "";
	for (let row = 0; row < ROWS; row += 1) {
		text += GLYPHS[(seed * 7 + row * 3) % GLYPHS.length];
	}
	return text;
}

export function HackerRain({ density = "splash" }: HackerRainProps): React.ReactElement {
	const count = COLUMNS[density];
	const columns = Array.from({ length: count }, (_, index) => column(index + (density === "workbench" ? 3 : 0)));
	return (
		<div className="astra-strix-rain" data-density={density} aria-hidden="true">
			{columns.map((text, index) => (
				<span key={index}>{text}</span>
			))}
		</div>
	);
}
