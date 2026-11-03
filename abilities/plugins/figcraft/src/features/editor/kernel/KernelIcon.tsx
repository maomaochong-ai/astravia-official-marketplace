import { GLYPHS } from "./glyphs.ts";

interface KernelIconProps {
	name: keyof typeof GLYPHS | string;
	size?: number;
	className?: string;
}

export function KernelIcon({ name, size = 16, className }: KernelIconProps) {
	const path = GLYPHS[name] ?? GLYPHS.select;
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.7}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={path} />
		</svg>
	);
}
