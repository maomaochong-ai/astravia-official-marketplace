/** 随包工艺文档的条目形状。数据由 scripts/build-reference-library.mjs 生成。 */
export type ReferenceKind = "guide" | "genre" | "style" | "voice";

export interface BundledReference {
	readonly id: string;
	readonly kind: ReferenceKind;
	readonly title: string;
	readonly body: string;
}
