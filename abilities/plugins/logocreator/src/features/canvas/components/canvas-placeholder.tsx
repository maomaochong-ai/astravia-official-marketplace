import { useMemo, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { coverSampleSvg } from "../../../domain/sample-mark";

/**
 * 空态封面。
 *
 * 上一版在这里画了一只猫当「位置图」，被读成「这个插件只会画卡通动物」——
 * 占位图应当说明**产物长什么样**，而不是先画一个玩具。
 *
 * 现在放的是一枚真实构图（引擎按最中性的风格渲染出来的完整 lockup：徽标 + 字标 + 标语），
 * 也就是用户点下「生成」之后会拿到的样子。它由引擎生成，与真实产物同一套代码，
 * 不会出现「封面好看、做出来不一样」。
 *
 * `pointer-events-none` 保留：空白画布上点一下仍然要落到 surface 上去放备注。
 */
export function CanvasPlaceholder(): JSX.Element {
	const { t } = useTranslation();
	const cover = useMemo(() => `data:image/svg+xml,${encodeURIComponent(coverSampleSvg())}`, []);

	return (
		<div
			className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden"
			aria-hidden
			data-testid="canvas-cover"
		>
			{/* 构图网格：引擎在 12.5% 的格子上落点，这里同步画出来，让封面与真实画布同源。 */}
			<div
				className="absolute inset-0 opacity-40"
				style={{
					backgroundImage:
						"linear-gradient(to right, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px)," +
						"linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px)",
					backgroundSize: "12.5% 12.5%",
				}}
			/>

			<img src={cover} alt="" className="relative w-[62%] max-w-64 opacity-90" draggable={false} />

			<div className="relative flex flex-col items-center gap-0.5 px-6 text-center">
				<span className="text-[12px] font-medium text-foreground">{t("placeholder.title")}</span>
				<span className="text-[10.5px] leading-snug text-muted-foreground">{t("placeholder.body")}</span>
				{/* 提醒画布本身可点击：不然用户不知道备注要“在画布上点一下”才留得下。 */}
				<span className="text-[10px] leading-snug text-muted-foreground/80">{t("notes.surfaceHint")}</span>
			</div>
		</div>
	);
}
