import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";

interface NewBookFormProps {
	busy: boolean;
	onCreate(input: {
		title: string;
		genre: string;
		premise: string;
		targetChapters: number;
	}): Promise<boolean>;
}

/** 目标章数的常用档位：点一下就填好，想写冷门长度仍可在数字框里手填。 */
const TARGET_PRESETS = [60, 120, 200] as const;

/** 字段标签走设计稿的元信息层：9px 等宽小字，与卡片里的其它小字同层。 */
const FIELD_LABEL = "font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70";

const FIELD_INPUT =
	"w-full rounded-[9px] border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:ring-2 focus:ring-ring/20";

/**
 * 开书表单（ADR 0024 §4）：空状态引导的第三步，其余步骤交给架构师智能体在对话里完成。
 *
 * 版面按「一页纸」重排：没有卡片边框，只有一组上下留白的字段；书名是唯一的大输入，
 * 题材与前提各占一行，目标章数用三个档位芯片 + 一个数字框，主按钮占满宽度。
 * 这样在窄侧栏里不会出现「四个小格子挤在框里」的观感。
 *
 * 控件尺寸按设计稿收：输入 36px 高、圆角 9px、纸色底（`bg-card` 对 `bg-muted` 画布），
 * 档位芯片 24px 高、选中时墨底反白——与书页和激活页的按钮同一套语言。
 */
export function NewBookForm({ busy, onCreate }: NewBookFormProps) {
	const { t } = useTranslation();
	const [title, setTitle] = useState("");
	const [genre, setGenre] = useState("");
	const [premise, setPremise] = useState("");
	const [target, setTarget] = useState("120");

	const ready = title.trim() && genre.trim() && premise.trim() && Number(target) > 0;

	return (
		<form
			className="mx-auto flex w-full max-w-md flex-col gap-5"
			onSubmit={async (event) => {
				event.preventDefault();
				if (!ready || busy) return;
				await onCreate({
					title: title.trim(),
					genre: genre.trim(),
					premise: premise.trim(),
					targetChapters: Number(target),
				});
			}}
		>
			<div className="flex flex-col gap-1">
				<h2 className="font-serif text-[19px] font-semibold leading-tight text-foreground">
					{t("newBook.title")}
				</h2>
				<p className="text-[11px] leading-4 text-muted-foreground">{t("newBook.genreHint")}</p>
			</div>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.name")}</span>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					className={`${FIELD_INPUT} h-10 font-serif text-[15px]`}
					autoFocus
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.genre")}</span>
				<input
					value={genre}
					onChange={(event) => setGenre(event.target.value)}
					className={`${FIELD_INPUT} h-9`}
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.premise")}</span>
				<textarea
					value={premise}
					onChange={(event) => setPremise(event.target.value)}
					rows={3}
					className={`${FIELD_INPUT} resize-none py-2 leading-5`}
				/>
			</label>

			<div className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.target")}</span>
				<div className="flex flex-wrap items-center gap-1.5">
					{TARGET_PRESETS.map((preset) => {
						const selected = Number(target) === preset;
						return (
							<button
								key={preset}
								type="button"
								aria-pressed={selected}
								onClick={() => setTarget(String(preset))}
								className={`flex h-6 items-center rounded-[6px] border px-2 font-mono text-[10px] tabular-nums transition-colors ${
									selected
										? "border-transparent bg-foreground font-medium text-background"
										: "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
								}`}
							>
								{preset}
							</button>
						);
					})}
					<input
						type="number"
						min={1}
						value={target}
						onChange={(event) => setTarget(event.target.value)}
						className={`${FIELD_INPUT} h-6 w-16 px-1.5 font-mono text-[10px] tabular-nums`}
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={!ready || busy}
				className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-foreground text-[12px] font-medium text-background transition-opacity disabled:opacity-40"
			>
				<span className="icon-[solar--add-circle-linear] size-3.5" />
				{t("newBook.submit")}
			</button>
		</form>
	);
}
