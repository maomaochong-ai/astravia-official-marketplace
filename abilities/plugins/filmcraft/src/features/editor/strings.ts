/**
 * Editor copy.
 *
 * Chinese is the default and English is the exception: the shell's locale decides,
 * and anything that is not English gets Chinese. Nothing here is fetched at runtime
 * and nothing is machine-translated — both languages are written by hand, which is
 * why the panel reads like a product instead of a dictionary.
 *
 * ADR: docs/adr/<slug>/craft-0012-chinese-is-rendered-here.md
 */

export interface EditorStrings {
	panelTitle: string;
	untitled: string;
	tools: Record<string, string>;
	undo: string;
	redo: string;
	fit: string;
	zoomIn: string;
	zoomOut: string;
	delete: string;
	duplicate: string;
	layers: string;
	emptyLayers: string;
	inspector: string;
	emptyInspector: string;
	position: string;
	size: string;
	fill: string;
	stroke: string;
	strokeWidth: string;
	radius: string;
	opacity: string;
	text: string;
	fontSize: string;
	fontWeight: string;
	color: string;
	align: string;
	alignLeft: string;
	alignCenterX: string;
	alignRight: string;
	alignTop: string;
	alignMiddle: string;
	alignBottom: string;
	distributeX: string;
	distributeY: string;
	front: string;
	back: string;
	forward: string;
	backward: string;
	exportPng: string;
	exportJson: string;
	openDocument: string;
	importImage: string;
	saved: string;
	unsaved: string;
	saving: string;
	shapes: string;
	selected: string;
	page: string;
	hint: string;
	canvasHint: string;
	locked: string;
	imagePick: string;
	clearSelection: string;
}

const ZH: EditorStrings = {
	panelTitle: "编辑器",
	untitled: "未命名",
	tools: {
		select: "选择",
		text: "文字",
		rect: "矩形",
		ellipse: "椭圆",
		line: "直线",
		image: "图片",
	},
	undo: "撤销",
	redo: "重做",
	fit: "适应窗口",
	zoomIn: "放大",
	zoomOut: "缩小",
	delete: "删除",
	duplicate: "再制",
	layers: "图层",
	emptyLayers: "还没有对象。选一个工具，在画布上点一下就开始了。",
	inspector: "属性",
	emptyInspector: "选中一个对象后，这里可以改颜色、尺寸和文字。",
	position: "位置",
	size: "尺寸",
	fill: "填充",
	stroke: "描边",
	strokeWidth: "描边宽度",
	radius: "圆角",
	opacity: "不透明度",
	text: "文字",
	fontSize: "字号",
	fontWeight: "字重",
	color: "颜色",
	align: "对齐",
	alignLeft: "左对齐",
	alignCenterX: "水平居中",
	alignRight: "右对齐",
	alignTop: "顶对齐",
	alignMiddle: "垂直居中",
	alignBottom: "底对齐",
	distributeX: "水平分布",
	distributeY: "垂直分布",
	front: "置顶",
	back: "置底",
	forward: "上移一层",
	backward: "下移一层",
	exportPng: "导出图片",
	exportJson: "导出工程",
	openDocument: "打开工程",
	importImage: "插入图片",
	saved: "已保存",
	unsaved: "未保存",
	saving: "保存中",
	shapes: "对象",
	selected: "已选",
	page: "页面",
	hint: "拖拽移动 · 双击改字 · Delete 删除 · ⌘Z 撤销",
	canvasHint: "从左侧选一个工具开始",
	locked: "锁定",
	imagePick: "选择一张图片",
	clearSelection: "取消选择",
};

const EN: EditorStrings = {
	panelTitle: "Editor",
	untitled: "Untitled",
	tools: {
		select: "Select",
		text: "Text",
		rect: "Rectangle",
		ellipse: "Ellipse",
		line: "Line",
		image: "Image",
	},
	undo: "Undo",
	redo: "Redo",
	fit: "Fit",
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	delete: "Delete",
	duplicate: "Duplicate",
	layers: "Layers",
	emptyLayers: "Nothing here yet. Pick a tool and click the page.",
	inspector: "Properties",
	emptyInspector: "Select an object to change its colour, size or text.",
	position: "Position",
	size: "Size",
	fill: "Fill",
	stroke: "Stroke",
	strokeWidth: "Stroke width",
	radius: "Radius",
	opacity: "Opacity",
	text: "Text",
	fontSize: "Size",
	fontWeight: "Weight",
	color: "Colour",
	align: "Align",
	alignLeft: "Align left",
	alignCenterX: "Centre horizontally",
	alignRight: "Align right",
	alignTop: "Align top",
	alignMiddle: "Centre vertically",
	alignBottom: "Align bottom",
	distributeX: "Distribute horizontally",
	distributeY: "Distribute vertically",
	front: "Bring to front",
	back: "Send to back",
	forward: "Bring forward",
	backward: "Send backward",
	exportPng: "Export image",
	exportJson: "Export project",
	openDocument: "Open project",
	importImage: "Insert image",
	saved: "Saved",
	unsaved: "Unsaved",
	saving: "Saving",
	shapes: "objects",
	selected: "selected",
	page: "Page",
	hint: "Drag to move · double-click to edit text · Delete removes · ⌘Z undoes",
	canvasHint: "Pick a tool on the left to begin",
	locked: "Locked",
	imagePick: "Choose an image",
	clearSelection: "Clear selection",
};

export function editorStrings(locale?: string): EditorStrings {
	return locale && locale.toLowerCase().startsWith("en") ? EN : ZH;
}
