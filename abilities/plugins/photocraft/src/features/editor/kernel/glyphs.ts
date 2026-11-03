/**
 * Icon paths, 24×24, drawn as strokes on `currentColor`.
 *
 * Inline rather than an icon font or a CDN: the panel has to render inside the
 * desktop shell with no network, and four glyphs from a 5000-icon set is not worth
 * a runtime dependency.
 */

export const GLYPHS: Record<string, string> = {
	select: "M5 3l14 8-6 1.5L10 19 5 3z",
	text: "M5 6h14M12 6v13M9 19h6",
	rect: "M4 6h16v12H4z",
	ellipse: "M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z",
	line: "M5 19L19 5",
	image: "M4 5h16v14H4zM4 15l4.5-4.5L13 15l3-3 4 4M9 9.5a1 1 0 100-2 1 1 0 000 2z",
	undo: "M9 8H5V4M5.6 8A7 7 0 1112 19",
	redo: "M15 8h4V4M18.4 8A7 7 0 1012 19",
	fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
	zoomIn: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.5-4.5M11 8v6M8 11h6",
	zoomOut: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.5-4.5M8 11h6",
	trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
	copy: "M9 9h11v11H9zM4 15V4h11",
	front: "M12 4l8 4-8 4-8-4 8-4zM4 14l8 4 8-4",
	back: "M4 10l8 4 8-4M12 4L4 8l8 4 8-4-8-4z",
	forward: "M12 3v14M7 8l5-5 5 5M4 20h16",
	backward: "M12 21V7M7 16l5 5 5-5M4 4h16",
	download: "M12 4v11M7 10l5 5 5-5M4 20h16",
	upload: "M12 16V5M7 10l5-5 5 5M4 20h16",
	folder: "M4 6h6l2 2h8v11H4z",
	alignLeft: "M4 4v16M8 8h11M8 16h7",
	alignCenterX: "M12 4v16M6 8h12M8 16h8",
	alignRight: "M20 4v16M5 8h11M9 16h7",
	alignTop: "M4 4h16M8 8v11M16 8v7",
	alignMiddle: "M4 12h16M8 6v12M16 8v8",
	alignBottom: "M4 20h16M8 5v11M16 9v7",
	distributeX: "M4 4v16M20 4v16M11 7v10M13 7v10",
	distributeY: "M4 4h16M4 20h16M7 11h10M7 13h10",
	lock: "M6 11h12v9H6zM9 11V8a3 3 0 016 0v3",
};
