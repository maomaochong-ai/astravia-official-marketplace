import type { SVGProps } from "react";

/**
 * 面板图标集：24 网格、1.5px 线宽、圆头端点的单色线性图标。
 * 统一继承 currentColor（跟随按钮的 text-* 配色），避免魔法类名导致的 CSS 缺失。
 */
type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...rest }: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...rest}
		>
			{children}
		</svg>
	);
}

export function IconBack(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M19 12H5" />
			<path d="M11 18l-6-6 6-6" />
		</IconBase>
	);
}

export function IconForward(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M5 12h14" />
			<path d="M13 6l6 6-6 6" />
		</IconBase>
	);
}

export function IconClose(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M6 6l12 12M18 6L6 18" />
		</IconBase>
	);
}

export function IconRefresh(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M20 12a8 8 0 1 1-2.34-5.66" />
			<path d="M20 4v4h-4" />
		</IconBase>
	);
}

export function IconOpenInNew(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M14 4h6v6" />
			<path d="M20 4l-9 9" />
			<path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
		</IconBase>
	);
}

/** 开始选择：瞄准器十字线（签名图形）。 */
export function IconCrosshair(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
			<circle cx="12" cy="12" r="2.2" />
		</IconBase>
	);
}

/** 停止选择：线框方块（与整套线性图标一致，避免实心块看不出图标）。 */
export function IconStop(props: IconProps) {
	return (
		<IconBase {...props}>
			<rect x="6.5" y="6.5" width="11" height="11" rx="2" />
		</IconBase>
	);
}

export function IconSend(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M22 2 11 13" />
			<path d="M22 2 15 22 11 13 2 9z" />
		</IconBase>
	);
}

/** 加载环：配合 animate-spin 旋转。 */
export function IconSpinner(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M21 12a9 9 0 1 1-6.22-8.56" />
		</IconBase>
	);
}

/**
 * 写轮眼（激活/复刻模式开）：实心轮廓 + 黑色瞳孔，一眼可见"已开"。
 * 使用 fill=currentColor，按钮容器传 text-foreground 即黑色 / text-background 即白色。
 */
export function IconEye(props: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{/* 眼轮廓（粗线 + 微填充，让形状一眼可辨） */}
			<path d="M1 12s4.5-8 11-8 11 8 11 8-4.5 8-11 8S1 12 1 12Z" fill="currentColor" fillOpacity="0.12" />
			{/* 瞳孔（实填充 = 已开） */}
			<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="3.2" />
		</svg>
	);
}

/**
 * 写轮眼关：空眼 + 斜线，一眼看出"被划掉/关闭"。
 */
export function IconEyeOff(props: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{/* 下半眼（眼形被斜线截断感） */}
			<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94" />
			{/* 上半眼 */}
			<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
			{/* 瞳孔空心（关 = 无填充） */}
			<circle cx="12" cy="12" r="3" />
			{/* 斜线贯穿 */}
			<path d="M3 3l18 18" />
		</svg>
	);
}

export function IconCog(props: IconProps) {
	return (
		<IconBase {...props}>
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</IconBase>
	);
}

export function IconWeb(props: IconProps) {
	return (
		<IconBase {...props}>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18" />
			<path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
		</IconBase>
	);
}

export function IconAlert(props: IconProps) {
	return (
		<IconBase {...props}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 8v4" />
			<path d="M12 16h.01" />
		</IconBase>
	);
}
