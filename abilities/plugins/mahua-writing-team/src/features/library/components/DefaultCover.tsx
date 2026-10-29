/**
 * 默认封面（ADR 0020 §4）。
 *
 * 每本书都有一张确定的封面，不是占位符：底色是 `currentColor` 的 6% 叠层，
 * 母题（横纹 / 圆点 / 弧线）与叠层深浅由 `book.id` 的稳定哈希选出。
 * 不用位图、不发网络请求、不出现 `#hex`——颜色全部来自宿主 token（ADR 0006）。
 *
 * 只画底纹；首字、进度条与文案由 `BookCover` 叠在上面，两者共用同一份图形。
 */

import { coverVariant } from "../library-model.js";

interface DefaultCoverProps {
	/** 哈希种子，用书 id 而不是书名：改名不该换封面。 */
	seed: string;
}

const LAYER_OPACITY = [0.05, 0.075, 0.1] as const;

function Motif({ motif }: { motif: 0 | 1 | 2 }) {
	if (motif === 1) {
		const dots: { cx: number; cy: number }[] = [];
		for (let row = 0; row < 6; row += 1) {
			for (let column = 0; column < 4; column += 1) {
				dots.push({ cx: 18 + column * 22, cy: 20 + row * 22 });
			}
		}
		return (
			<g opacity="0.35">
				{dots.map((dot) => (
					<circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r="3" fill="currentColor" />
				))}
			</g>
		);
	}
	if (motif === 2) {
		return (
			<g opacity="0.3" fill="none" stroke="currentColor" strokeWidth="2">
				<path d="M-10 120 A 70 70 0 0 1 110 120" />
				<path d="M-10 140 A 90 90 0 0 1 110 140" />
				<path d="M-10 160 A 110 110 0 0 1 110 160" />
			</g>
		);
	}
	return (
		<g opacity="0.3">
			{/* 320 宽 → 130 高的网格里，条带写在 12–118 之间，不留出血边。 */}
			{[12, 38, 64, 90, 112].map((y) => (
				<rect key={y} x="0" y={y} width="100" height="8" fill="currentColor" />
			))}
		</g>
	);
}

export function DefaultCover({ seed }: DefaultCoverProps) {
	const { motif, layer } = coverVariant(seed);
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			viewBox="0 0 100 130"
			preserveAspectRatio="none"
			className="absolute inset-0 h-full w-full"
		>
			<rect width="100" height="130" fill="currentColor" opacity={LAYER_OPACITY[layer]} />
			<Motif motif={motif} />
		</svg>
	);
}
