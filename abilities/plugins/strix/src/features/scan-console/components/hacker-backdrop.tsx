/**
 * 背景的"氛围层"：极光、坐标网格、斜切扫光。
 *
 * 与 `hacker-rain` 的分工：那个是**内容**（下落的码流，有字符、有节奏），
 * 这个是**底子**（色彩与结构），两者叠在同一层 z-index:0 上，正文压在它们之上。
 *
 * 三条决定：
 *
 * 1. **不下载网络图片**。用户提过"可以从网上找黑客背景图"，但那一类素材同时踩三个坑：
 *    许可证不明（要随官方市场分发）、体积与分辨率不确定（面板宽 300–1400px）、
 *    颜色不可控（换成别的图，绿字就可能糊在图上）。这里的"炫彩"由 CSS 渐变与内联
 *    SVG 网格构成——**颜色是我们自己的变量**，所以能和 `--sx-text` 对得上，
 *    也能随磷光档切换。
 * 2. **对比度优先**。三层的不透明度上限写死在 CSS 里（极光 .20 / 网格 .12 / 扫光 .16），
 *    且颜色都从绿-青-紫这一族取：再花也不会把绿字压成灰字。
 * 3. **动效可关**。`prefers-reduced-motion` 下极光与扫光静止（雨本来就会静止）。
 *
 * 确定性：没有任何随机数，网格与渐变的每个数值都是常量，截图与测试可复现。
 */

export interface HackerBackdropProps {
	/** `splash`：首屏，极光更亮；`workbench`：工作台，整体压到一半（后面是正文）。 */
	density?: "splash" | "workbench";
}

export function HackerBackdrop({ density = "splash" }: HackerBackdropProps): React.ReactElement {
	return (
		<div className="astra-strix-backdrop" data-density={density} aria-hidden="true">
			{/* 极光：三个色团在四角缓慢游动。绿/青/紫是同一族冷色，绿字仍是重心。 */}
			<span className="astra-strix-aurora" />
			{/* 网格：8px 点阵 + 64px 主格。它给"这是仪表"的感觉，比纯黑更有质地。 */}
			<span className="astra-strix-mesh" />
			{/* 雷达同心环：以右下角为圆心的一圈圈刻度，90s 转一圈。 */}
			<span className="astra-strix-rings" />
			{/* 斜切扫光：一条极淡的光带缓慢横穿，像示波器扫过。 */}
			<span className="astra-strix-sheen" />
			{/* 边角压暗：让视线落在中间那一列字上。 */}
			{/* 地平线：底部 42% 的透视网格，给纵深。 */}
			<span className="astra-strix-horizon" />
			<span className="astra-strix-vignette" />
			{/* 噪点：模拟屏幕颗粒，也是深色渐变的条带遮罩。 */}
			<span className="astra-strix-grain" />
		</div>
	);
}
