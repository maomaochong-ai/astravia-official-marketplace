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

/** 空状态引导：三步开书的第一步。其余步骤交给架构师智能体在对话里完成。 */
export function NewBookForm({ busy, onCreate }: NewBookFormProps) {
	const { t } = useTranslation();
	const [title, setTitle] = useState("");
	const [genre, setGenre] = useState("");
	const [premise, setPremise] = useState("");
	const [target, setTarget] = useState("120");

	const ready = title.trim() && genre.trim() && premise.trim() && Number(target) > 0;

	return (
		<form
			className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
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
			<h2 className="text-sm font-medium">{t("newBook.title")}</h2>

			<label className="flex flex-col gap-1">
				<span className="text-xs text-muted-foreground">{t("newBook.name")}</span>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-xs text-muted-foreground">{t("newBook.genre")}</span>
				<input
					value={genre}
					onChange={(event) => setGenre(event.target.value)}
					placeholder={t("newBook.genreHint")}
					className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-xs text-muted-foreground">{t("newBook.premise")}</span>
				<textarea
					value={premise}
					onChange={(event) => setPremise(event.target.value)}
					rows={3}
					className="resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>

			<label className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">{t("newBook.target")}</span>
				<input
					type="number"
					min={1}
					value={target}
					onChange={(event) => setTarget(event.target.value)}
					className="h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>

			<button
				type="submit"
				disabled={!ready || busy}
				className="mt-1 self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
			>
				{t("newBook.submit")}
			</button>
		</form>
	);
}
