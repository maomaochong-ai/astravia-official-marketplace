/**
 * 面板用的一套 24×24 线性图标。
 *
 * 手写 path 而不是引入 Iconify：插件包已经有 8 个工具与完整引擎，
 * 为十几个图标再加一个图标依赖与字体分片不划算，也没必要。
 * 所有图形只表达含义，颜色由 currentColor 决定。
 */

const PATHS: Record<string, readonly string[]> = {
	layout: ["M4 4h16v16H4z", "M4 10h16", "M9 10v10"],
	book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 18.5V21h15"],
	boxes: ["M3 8.5 8 6l5 2.5L8 11z", "M13 15.5 18 13l3 2.5-5 2.5z", "M3 8.5V16l5 2.5V11"],
	scan: ["M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8", "M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8", "M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16", "M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16", "M8 11h8"],
	type: ["M5 6V4h14v2", "M12 4v16", "M9 20h6"],
	shield: ["M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z", "M9 12l2 2 4-4"],
	activity: ["M3 12h4l3-7 4 14 3-7h4"],
	fingerprint: ["M6 8a6 6 0 0 1 12 0v3", "M9 11a3 3 0 0 1 6 0v4", "M12 11v6", "M6 13v2a6 6 0 0 0 2 4.5", "M18 13v2a6 6 0 0 1-2 4.5"],
	compare: ["M6 4v16", "M18 4v16", "M3 8l3-4 3 4", "M15 16l3 4 3-4"],
	clipboard: ["M8 4h8v3H8z", "M8 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H16", "M9 13l2 2 4-4"],
	file: ["M6 3h8l4 4v14H6z", "M14 3v4h4", "M9 12h6", "M9 16h4"],
	settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M12 3v2.5", "M12 18.5V21", "M3 12h2.5", "M18.5 12H21", "M5.6 5.6l1.8 1.8", "M16.6 16.6l1.8 1.8", "M18.4 5.6l-1.8 1.8", "M7.4 16.6l-1.8 1.8"],
	send: ["M4 12 20 4l-6 16-3-6z", "M11 14 20 4"],
	sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z"],
	refresh: ["M20 11a8 8 0 1 0-2.3 6.2", "M20 4v7h-7"],
	folder: ["M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"],
	ban: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M6 18 18 6"],
	close: ["M6 6l12 12", "M18 6 6 18"],
	search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M16.5 16.5 21 21"],
	chevron: ["M9 6l6 6-6 6"],
	check: ["M5 12.5 10 17l9-10"],
	alert: ["M12 4 3 20h18z", "M12 10v4", "M12 17.2v.1"],
	info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v6", "M12 7.5v.1"],
	copy: ["M9 9h10v11H9z", "M15 6H5v11"],
	save: ["M4 5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", "M8 4v6h7V4", "M8 20v-6h8v6"],
	play: ["M7 4l12 8-12 8z"],
	arrow: ["M4 12h15", "M13 6l6 6-6 6"],
	message: ["M4 5h16v11H9l-5 4z"],
	lock: ["M6 11h12v9H6z", "M9 11V8a3 3 0 0 1 6 0v3"],
	chip: ["M7 7h10v10H7z", "M10 3v4", "M14 3v4", "M10 17v4", "M14 17v4", "M3 10h4", "M3 14h4", "M17 10h4", "M17 14h4"],
	folderSearch: ["M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M13.5 12.5 16 15"],
	eye: ["M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
};

export interface IconProps {
	name: keyof typeof PATHS | string;
	className?: string;
}

export function Icon({ name, className }: IconProps) {
	const paths = PATHS[name] ?? PATHS.info!;
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className ?? "size-4"}>
			{paths.map(path => (
				<path key={path} d={path} />
			))}
		</svg>
	);
}
