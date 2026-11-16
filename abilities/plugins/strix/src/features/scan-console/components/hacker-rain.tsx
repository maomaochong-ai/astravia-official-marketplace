/**
 * 下落的代码背景。
 *
 * 四个决定：
 *
 * 1. **确定性伪随机**，不用 `Math.random()`：每列有自己的速度、起始相位、长度、亮度、
 *    字符相位与断行位置，但同一列每次渲染都一样——截图与测试可复现，刷新也不"抖"。
 * 2. **纯 CSS 动画**（`translateY` + 逐列 inline 的 duration/delay）：不占主线程，
 *    不与滚动和 resize 抢帧。
 * 3. **逐列错开，而不是 nth-child 分档**（1.0.7）：原来只有 9/12/15/7s 四个值，
 *    整屏会周期性对齐成一道一道的横波，看起来"有规则"。现在是连续分布 + 负延迟，
 *    任何两列的周期都不同，也就不会同步。
 * 4. **密度由列数控制**，两处取值不同：首屏是主角（较疏、更亮），工作台更密但更淡。
 *
 * 无障碍：`prefers-reduced-motion` 下所有列静止（style.css），且整体 `aria-hidden`——
 * 它是装饰，不该被读屏念出来。
 */

/** 字形：0/1 + 半角片假名 + 符号。上游 splash 没有这个背景，这是本插件的加法。 */
/**
 * 字形：0/1 + 本项目的英文词。
 *
 * 原来混了半角片假名（那是《黑客帝国》的语汇），但界面其余部分全中文、字标是英文，
 * 混进去反而像乱码。现在统一成 0/1 与这一轮评估真的会出现的词：谁读到它都知道在讲什么。
 */
const GLYPHS = "01STRIXRECONEXPLOITSANDBOXSCOPEPATCHPROXYBROWSERFINDINGCOVERAGETODO";

/** 断行：一段里偶尔空一格，于是列是"断续的码流"而不是一根实心条。 */
const GAP = " ";

export interface HackerRainProps {
	/** `splash`：首屏，较疏但更亮；`workbench`：工作台，更密但更淡。 */
	density?: "splash" | "workbench";
}

/** 列数：工作台比首屏更密（用户反馈首屏不够密，两处一起提上来）。 */
/**
 * 列数。
 *
 * 首屏是主角：72 列、字号也更大（用户的原话是“代码雨过少和过小”）。
 * 工作台反过来收：它后面就是要读的运行记录，40 列够做出“底子在动”的感觉，
 * 又不至于让每一帧多画两千个字形。
 */
const COLUMNS: Record<NonNullable<HackerRainProps["density"]>, number> = {
	splash: 72,
	workbench: 40,
};

/** 每列的基准字数：实际长度在它上下浮动，见 `column()`。 */
const ROWS = 34;

/**
 * xorshift32：把列号搅成互不相关的伪随机数。
 *
 * 为什么不用 `index * 7 % n`：那种线性同余会让相邻列落在同一条斜线上，
 * 屏幕上就是一道道平行的斜纹（1.0.7 之前的观感）。这里一次扰动就把相位打散。
 */
function hash(seed: number): number {
	let value = (seed + 0x9e3779b9) >>> 0;
	value ^= value << 13;
	value >>>= 0;
	value ^= value >>> 17;
	value ^= value << 5;
	value >>>= 0;
	return value;
}

/** 从一次扰动里取一段：`bits` 决定这一段能有多少个不同取值。 */
function pick(seed: number, shift: number, spread: number): number {
	return (seed >>> shift) % spread;
}

interface Column {
	text: string;
	/** 下落周期（秒）。**逐列连续分布**，不是几档跳变。 */
	duration: number;
	/** 负延迟：加载时就处于行程中段，于是第一帧不会整齐排成一条线。 */
	delay: number;
	opacity: number;
}

/**
 * 生成一列。
 *
 * 长度 18–52 字、周期 7–31s、相位 0–40s、亮度 0.35–1，四个维度各自独立扰动，
 * 所以相邻列几乎不会同拍；字符按 `hash(column, row)` 取，不是等差序列，
 * 因此不会出现"斜着一条同字"的纹路。
 */
function column(index: number, offset: number, frame = 0): Column {
	const seed = hash((index + 1) * 0x85ebca6b + offset * 0xc2b2ae35);
	const length = 18 + pick(seed, 2, 35);
	const duration = 7 + pick(seed, 9, 241) / 10;
	const delay = pick(seed, 15, 401) / 10;
	const opacity = 0.35 + pick(seed, 21, 66) / 100;

	let text = "";
	for (let row = 0; row < length; row += 1) {
		// 字符随帧变化：每一帧把种子混进一个变化的乘数，同一列同一格就会换成别的字。
		const cell = hash(seed ^ ((row + 1) * 0x27d4eb2f) ^ (frame * 0x9e3779b1));
		// 约 1/8 的格子留白：码流有断续感，而不是一根实心竖条。
		text += pick(cell, 5, 8) === 0 ? GAP : GLYPHS[pick(cell, 11, GLYPHS.length)];
	}

	return { text, duration, delay, opacity };
}

import { useEffect, useState } from "react";
import { usePageVisible } from "../../../shared/hooks/use-page-visible";

export function HackerRain({ density = "splash" }: HackerRainProps): React.ReactElement {
	const visible = usePageVisible();
	/**
	 * 帧计数：每 160ms 换一批字符。
	 *
	 * 为什么用定时器而不是 CSS：CSS 换不了文本内容。160ms 是“看得出在跳”与“不刺眼”的交界；
	 * 页面在后台时停掉（usePageVisible），不给宿主添无谓的重渲染。
	 */
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		if (!visible) return;
		const timer = setInterval(() => setFrame((value) => (value + 1) % 4096), 160);
		return () => clearInterval(timer);
	}, [visible]);
	const count = COLUMNS[density];
	const columns = Array.from({ length: count }, (_, index) => column(index, density === "workbench" ? 3 : 0, frame));
	return (
		<div className="astra-strix-rain" data-density={density} data-quiet={visible ? "no" : "yes"} aria-hidden="true">
			{columns.map((entry, index) => (
				<span
					key={index}
					style={{
						animationDuration: `${entry.duration.toFixed(1)}s`,
						animationDelay: `-${entry.delay.toFixed(1)}s`,
						opacity: entry.opacity,
					}}
				>
					{entry.text}
				</span>
			))}
		</div>
	);
}
