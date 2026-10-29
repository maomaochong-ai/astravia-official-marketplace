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

const FIELD_LABEL = "text-xs font-medium text-muted-foreground";
const FIELD_INPUT =
	"w-full rounded-lg border border-border/70 bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/30";

/**
 * 开书表单（ADR 0024 §4）：空状态引导的第三步，其余步骤交给架构师智能体在对话里完成。
 *
 * 版面按「一页纸」重排：没有卡片边框，只有一组上下留白的字段；书名是唯一的大输入，
 * 题材与前提各占一行，目标章数用三个档位芯片 + 一个数字框，主按钮占满宽度。
 * 这样在窄侧栏里不会出现「四个小格子挤在框里」的观感。
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
			className="mx-auto flex w-full max-w-md flex-col gap-6"
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
				<h2 className="text-base font-medium">{t("newBook.title")}</h2>
				<p className="text-xs leading-[17px] text-muted-foreground">{t("newBook.genreHint")}</p>
			</div>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.name")}</span>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					className={`${FIELD_INPUT} h-11 text-[15px]`}
					autoFocus
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.genre")}</span>
				<input
					value={genre}
					onChange={(event) => setGenre(event.target.value)}
					className={`${FIELD_INPUT} h-10`}
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className={FIELD_LABEL}>{t("newBook.premise")}</span>
				<textarea
					value={premise}
					onChange={(event) => setPremise(event.target.value)}
					rows={3}
					className={`${FIELD_INPUT} resize-none py-2 leading-6`}
				/>
			</label>

			<div className="flex flex-col gap-2">
				<span className={FIELD_LABEL}>{t("newBook.target")}</span>
				<div className="flex flex-wrap items-center gap-2">
					{TARGET_PRESETS.map((preset) => {
						const selected = Number(target) === preset;
						return (
							<button
								key={preset}
								type="button"
								aria-pressed={selected}
								onClick={() => setTarget(String(preset))}
								className={`rounded-full border px-3 py-1 text-xs tabular-nums transition-colors ${
									selected
										? "border-transparent bg-primary text-primary-foreground"
										: "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
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
						className={`${FIELD_INPUT} h-8 w-20 px-2 text-xs tabular-nums`}
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={!ready || busy}
				className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
			>
				{t("newBook.submit")}
			</button>
		</form>
	);
}
