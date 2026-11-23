import { createElement, type JSX, type ReactNode } from "react";
import { ICON_PATHS, type IconNode } from "./icons.generated";

/**
 * 面板图标。图形不手绘：从 `@iconify-json/solar` 生成到 `icons.generated.ts`
 * （`scripts/sync-icons.mjs` 维护，`--check` 可在测试里当护栏）。
 *
 * 为什么改成生成的：上一版每个图标都是手抄路径，线宽与视觉重量各不相同，
 * dock 读起来像一堆「杂乱的小图形」。宿主的界面本身就用 Solar，用同一套才有官方感，
 * 而且小尺寸下（14–16 px）实心图标比细描边立得住。
 *
 * 这里只做「把节点树变成 React 元素」一件事：颜色一律 `currentColor`（图标本身
 * 只填充路径，颜色由文本色继承），尺寸由调用方的 className 决定。
 *
 * 注意：活动面板 tab 与输入栏徽标用的是**插件的品牌 mark**（`ctx.plugin.iconUrl`），
 * 不走这套 —— 品牌面不该用一套通用字形。
 */

function renderNode(node: IconNode, key: number): ReactNode {
	const children = node.children?.map((child, index) => renderNode(child, index));
	return createElement(node.tag, { ...node.attrs, key, "aria-hidden": true }, ...(children ?? []));
}

export interface IconProps {
	className?: string;
}

/** 所有图标共用的外壳：24 格、随字号着色。 */
function Glyph({ name, className = "size-4" }: IconProps & { name: keyof typeof ICON_PATHS }): JSX.Element {
	const nodes = ICON_PATHS[name] ?? [];
	return (
		<svg viewBox="0 0 24 24" className={className}>
			{nodes.map((node, index) => renderNode(node, index))}
		</svg>
	);
}

/** 一件导出 = 一个名字；调用点只认用途，不认 Solar 的 id。 */
const glyph = (name: keyof typeof ICON_PATHS) => {
	function Icon(props: IconProps): JSX.Element {
		return <Glyph name={name} {...props} />;
	}
	Icon.displayName = `Icon(${name})`;
	return Icon;
};

export const IconGenerate = glyph("generate");
export const IconImageSize = glyph("imageSize");
export const IconRaster = glyph("raster");
export const IconReference = glyph("reference");
export const IconShuffle = glyph("surprise");
export const IconSliders = glyph("inspector");
export const IconNote = glyph("notes");
export const IconExport = glyph("export");
export const IconHistory = glyph("history");
export const IconAi = glyph("ai");
export const IconReset = glyph("reset");
export const IconClose = glyph("close");
export const IconCheck = glyph("check");
export const IconTrash = glyph("trash");
export const IconCopy = glyph("copy");
/** 收藏：Solar 的 star-bold 本身就是实心；`filled` 只为兼容旧调用点，不再区分。 */
export const IconStar = ({ filled: _filled, ...props }: IconProps & { filled?: boolean }): JSX.Element => (
	<Glyph name="star" {...props} />
);
export const IconRename = glyph("rename");
export const IconEye = glyph("eye");
export const IconVector = glyph("vector");
export const IconPalette = glyph("palette");
export const IconEyedropper = glyph("eyedropper");

/** 旧名字保留成别名：画布与对话框里还有调用点，改名不该顺手改动那些文件。 */
export const IconCanvas = IconVector;
export const IconSpark = IconAi;
