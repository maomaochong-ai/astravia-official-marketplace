import type { PluginTranslate } from "@astravia-org/plugin-sdk";
import type { Instruction, NovelBook } from "../../domain/novel-types.js";
import type { StudioMember } from "../../studio-members.js";

/**
 * 对话桥要说的话（ADR 0008 / 0011）。三处共用同一份拼装：
 * 工作台的 [继续]、成员胶囊的「叫上场」、新会话页的「把这一步交给团队」。
 * 谁改了措辞，三处一起变——它们说的本来就是同一句话。
 */
export function nextStepPrompt(t: PluginTranslate, book: NovelBook, instruction: Instruction | null): string {
	return t("studio.handoff", {
		title: book.title,
		phase: t(`phase.${book.phase}`),
		task: instruction ? t(`task.${instruction.task}`) : "",
		chapter: String(instruction?.chapter ?? book.progress.currentChapter),
	});
}

/** 点名某位成员时，话术带上他的职责——否则团队会话不知道该让谁接。 */
export function invitePrompt(t: PluginTranslate, member: StudioMember, book: NovelBook | null): string {
	const name = t(member.nameKey);
	if (!book) return t("invite.noBook", { member: name });
	return t(member.inviteKey, {
		member: name,
		title: book.title,
		phase: t(`phase.${book.phase}`),
		chapter: String(book.progress.currentChapter),
	});
}

/** 还没有书时，新会话页只提供一件事：把选题立起来。 */
export function newBookPrompt(t: PluginTranslate): string {
	return t("composer.newBookPrompt");
}
