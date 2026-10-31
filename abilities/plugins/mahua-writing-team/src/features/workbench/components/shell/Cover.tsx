import { COVER_ART } from "../../cover-art";

const SIZES = {
	shelf: { box: "h-[212px] w-[150px]", mark: 62 },
	row: { box: "h-[124px] w-[88px]", mark: 34 },
	detail: { box: "h-[262px] w-[186px]", mark: 76 },
	mini: { box: "h-[62px] w-[44px]", mark: 17 },
	/* 台账行里的缩略：比 mini 再小一档，行高 66 也放得下 */
	thumb: { box: "h-[46px] w-[33px]", mark: 12 },
} as const;

export type CoverSize = keyof typeof SIZES;

/**
 * 内联 SVG 封面：母题与深浅只由书名推出的三个编号决定。
 *
 * 不引位图、不发网络请求；颜色也不写在这里——三套纸色在 style.css 的 `.mahua-cover` 里，
 * 组件只用 `data-layer` / `data-motif` 选，视图层因此永远不出现字面色值。
 */
export function Cover({
	mark,
	motif,
	layer,
	art = 0,
	size = "shelf",
}: {
	mark: string;
	motif: number;
	layer: number;
	/** 纸纹底片的下标；越界时退回第一张。 */
	art?: number;
	size?: CoverSize;
}) {
	const tone = ((layer % 3) + 3) % 3;
	const grain = ((motif % 3) + 3) % 3;
	const dims = SIZES[size];
	const texture = COVER_ART[((art % COVER_ART.length) + COVER_ART.length) % COVER_ART.length] ?? COVER_ART[0];

	return (
		<div
			className={`mahua-cover relative shrink-0 overflow-hidden rounded-tile ${dims.box}`}
			data-layer={tone}
			data-motif={grain}
			aria-hidden="true"
		>
			<img
				className="cover-texture absolute inset-0 size-full object-cover"
				src={texture}
				alt=""
				draggable={false}
			/>
			<svg className="absolute inset-0 size-full" viewBox="0 0 100 140" preserveAspectRatio="none">
				{grain === 0 && (
					<g className="cover-line" strokeWidth="0.7">
						{[96, 104, 112, 120, 128, 136].map((y) => (
							<line key={y} x1="0" x2="100" y1={y} y2={y} />
						))}
						<line x1="0" x2="100" y1="88" y2="88" strokeWidth="2.4" />
					</g>
				)}
				{grain === 1 && (
					<g className="cover-line" fill="none">
						<circle cx="50" cy="62" r="30" strokeWidth="1.1" />
						<circle className="cover-dot" cx="50" cy="62" r="3" stroke="none" />
						<line x1="50" x2="50" y1="18" y2="34" strokeWidth="0.8" />
						<line x1="50" x2="50" y1="90" y2="112" strokeWidth="0.8" />
					</g>
				)}
				{grain === 2 && (
					<g className="cover-line">
						{[14, 26, 38, 50, 62, 74, 86].map((x) => (
							<line key={x} x1={x} x2={x} y1="14" y2="104" strokeWidth="0.6" />
						))}
						<rect className="cover-dot" x="0" y="112" width="100" height="12" stroke="none" opacity="0.55" />
					</g>
				)}
			</svg>

			<span
				className="cover-glyph absolute inset-0 flex items-center justify-center leading-none"
				style={{ fontSize: dims.mark, paddingBottom: dims.mark * 0.35 }}
			>
				{mark}
			</span>
		</div>
	);
}
