import { resolvePalette } from "../../domain/color-plan";
import { resolveMark } from "../../domain/engine/compose";
import type { LogoSpec } from "../../domain/spec";

/**
 * 一份设计的一行参数摘要，交给宿主 AI。
 *
 * 为什么需要它：备注与「发送到对话」过去只说「看看我的备注」，agent 于是自己挑一套
 * 结构 / 风格 / 主色去改稿 —— 改出来的和面板里这份不是同一个东西，用户就得再解释一遍。
 * 摘要带上真正决定画面的那几个字段（结构、风格、细节、主色、种子、品牌名），
 * 「按这些参数改」才是一句可执行的话。
 *
 * 不含内部字段（idSalt、导出档位一类）：它们不影响 agent 的判断，只会让那句话变长。
 */
export function describeSpec(spec: LogoSpec): string {
	if (!spec.brandName.trim()) return "";
	const palette = resolvePalette(spec);
	const subject = resolveMark(spec).subject;
	return [
		`brand "${spec.brandName}"`,
		`structure ${spec.type}`,
		`style ${spec.style}`,
		`detail ${spec.detail}`,
		`mark "${subject}"`,
		`primary ${palette.primary}`,
		`seed ${spec.seed}`,
	].join(", ");
}
