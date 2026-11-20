import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useMemo, useState } from "react";
import { PACKS } from "../../../../domain/inject/packs";
import { applyCommand, scriptPathFor } from "../../../../domain/inject/apply";
import { renderBatchRemoval, renderInstaller, renderRemovalScript, renderRestoreScript, type Shell } from "../../../../domain/inject/script";
import { INJECT_TARGETS, planFor, type InjectForm } from "../../../../domain/inject/targets";
import { loadPackBody } from "../../services/packs";
import { Card } from "../shell/card";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import type { PageProps } from "./overview";

const FORM_TONE: Record<InjectForm, string> = {
	"marker-block": "bg-surface-3 text-text-2",
	"system-layer": "bg-purple/12 text-purple",
	"config-key": "bg-risk-medium/12 text-risk-medium",
	cdp: "bg-risk-medium/12 text-risk-medium",
	unavailable: "bg-surface-3 text-text-4",
};

/**
 * 注入页：目标卡片矩阵 + 单目标检查器。
 *
 * 卡片布局对齐上游桌面注入器 —— 每个目标一张卡，卡上就能看到形态、层级、写入点并直接动手。
 * 「在对话里执行」不是装饰：面板不能调用 agent 工具，但它能把一句话交给对话，
 * 由那里的 Agent 调 `inject_target { apply: true }` 走命令通道真执行，再把证据带回来。
 */
export function InjectPage({ model, embedded = false }: PageProps & { embedded?: boolean }) {
	const { t } = useTranslation();
	const [targetId, setTargetId] = useState<string>(INJECT_TARGETS[0]?.id ?? "");
	const [packId, setPackId] = useState<string>(PACKS[0]?.id ?? "");
	const [shell, setShell] = useState<Shell>("powershell");
	const [body, setBody] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	// 能批量摘除的只有 marker-block 目标：系统层要整份还原，不可用目标本来就不存在。
	const markerTargets = INJECT_TARGETS.filter(item => item.form === "marker-block");
	// 批量清除是唯一会“一次动多个目标”的动作：先亮出将改哪些文件，再给确认。
	// 6 秒后自动收回，避免按钮长期处于已武装状态被误点。
	// 6 秒后自动收回，避免按钮长期处于已武装状态被误点。
	const [clearArmed, setClearArmed] = useState(false);

	// 正文按需读：包不在分块里，切包时才取。
	useEffect(() => {
		let alive = true;
		setBody(null);
		setFailure(null);
		if (!packId) return;
		loadPackBody(packId)
			.then(text => {
				if (alive) setBody(text);
			})
			.catch((error: unknown) => {
				if (alive) setFailure(error instanceof Error ? error.message : String(error));
			});
		return () => {
			alive = false;
		};
	}, [packId]);

	const target = INJECT_TARGETS.find(item => item.id === targetId) ?? INJECT_TARGETS[0];
	const plan = useMemo(
		() => (target ? planFor(target, { packLabel: packId, body: body ?? "" }) : null),
		[target, packId, body],
	);

	const copy = (text: string, message: string) => {
		navigator.clipboard?.writeText(text).then(
			() => model.notify(message, "success"),
			() => model.notify(t("panel.action.copyFailed"), "error"),
		);
	};

	const askToApply = (id: string, label: string) => {
		model.askText(
			[
				`用 inject_target 给 ${label}（target: ${id}）装提示词包 ${packId}，shell 用 ${shell}，apply: true。`,
				"执行后按它返回的 exit code / 备份路径 / 标记回读三行告诉我结果；没通过就说没通过，不要当成装好了。",
			].join("\n"),
		);
	};

	return (
		<>
			{embedded ? null : <PageHeader title={t("page.inject.title")} description={t("page.inject.lead")} />}

			<div className="fb-page">
				<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[10.5px] leading-relaxed text-text-3 ring-1 ring-line-subtle">
					<Icon name="shield" className="size-3.5 shrink-0 text-accent" />
					<span className="min-w-0 flex-1">{t("inject.intro")}</span>
					{clearArmed ? (
						<span className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 rounded-md border border-risk-high/40 bg-risk-high/10 px-2 py-0.5">
							<span className="min-w-0 truncate text-risk-high">
								{t("inject.clearAll.confirm", { count: markerTargets.length })}
							</span>
							<button
								type="button"
								onClick={async () => {
									setClearArmed(false);
									const script = renderBatchRemoval(
										markerTargets.map(item => planFor(item, { packLabel: packId, body: body ?? "" })),
										shell,
									);
									// 除了复制，还落一份到工作区：用户问的「脚本在哪个目录下」得有答案。
									const name = shell === "powershell" ? "uninstall-all.ps1" : "uninstall-all.sh";
									const saved = await model.saveInjectScript(name, script);
									copy(script, saved ? t("inject.copiedTo", { path: saved }) : t("inject.copied"));
								}}
								className="shrink-0 rounded bg-risk-high px-1.5 py-0.5 font-medium text-surface"
							>
								{t("inject.clearAll.yes")}
							</button>
							<button
								type="button"
								onClick={() => setClearArmed(false)}
								className="shrink-0 rounded px-1.5 py-0.5 text-text-3 hover:text-text"
							>
								{t("inject.clearAll.cancel")}
							</button>
						</span>
					) : (
						<button
							type="button"
							onClick={() => setClearArmed(true)}
							title={t("inject.clearAll.hint", { count: markerTargets.length })}
							className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 hover:bg-surface-hover hover:text-text"
						>
							<Icon name="close" className="size-3" />
							{t("inject.clearAll")}
						</button>
					)}
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<FilterChips items={PACKS.map(pack => ({ id: pack.id, label: pack.title }))} value={packId} onChange={setPackId} />
					<SegmentedControl<Shell>
						size="sm"
						value={shell}
						onValueChange={setShell}
						ariaLabel={t("inject.shell")}
						items={[
							{ value: "powershell", label: "PowerShell" },
							{ value: "posix", label: "sh" },
						]}
					/>
					<span className="ms-auto font-mono text-[10px] text-text-4">
						{body === null ? t("inject.pack.loading") : t("inject.pack.chars", { count: PACKS.find(pack => pack.id === packId)?.chars ?? 0 })}
					</span>
				</div>
				<div className="fb-fill grid min-h-0 gap-2.5 grid-rows-[minmax(0,45%)_minmax(0,1fr)] @min-[900px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] @min-[900px]:grid-rows-[minmax(0,1fr)]">
					<Card title={t("inject.targets.title")} bodyClassName="p-0" fill>
						<div className="fb-scroll fb-fill-scroll flex flex-col gap-2 overflow-y-auto p-2.5">
							{INJECT_TARGETS.map(item => {
								const active = item.id === targetId;
								const blocked = item.form === "unavailable";
								return (
									<div
										key={item.id}
										data-target-id={item.id}
										className={`rounded-lg border p-2.5 transition-colors ${
											active ? "border-line-strong bg-surface-3" : "border-line-subtle bg-surface-2 hover:border-line-strong"
										}`}
									>
										<button type="button" onClick={() => setTargetId(item.id)} className="flex w-full items-center gap-2 text-left">
											<span className="min-w-0 flex-1 truncate text-[12px] font-medium text-text">{item.label}</span>
											<span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide ${FORM_TONE[item.form]}`}>
												{t(`inject.form.${item.form}`)}
											</span>
										</button>
										<div className="mt-1 w-full truncate font-mono text-[10px] text-text-4">{item.entry}</div>
										{/* 操作按可用性出现：不可用目标不给「执行」，否则等于给一个永远失败的按钮。 */}
										<div className="mt-2 flex flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => copy(renderInstaller(planFor(item, { packLabel: packId, body: body ?? "" }), shell), t("inject.copied"))}
												className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 hover:bg-surface-hover hover:text-text"
											>
												<Icon name="copy" className="size-3" />
												{t("inject.copy")}
											</button>
											{blocked ? (
												<span className="px-1 text-[10px] text-text-4">{t("inject.unavailableHint")}</span>
											) : (
												<button
													type="button"
													onClick={() => askToApply(item.id, item.label)}
													className="inline-flex items-center gap-1 rounded-md bg-text px-1.5 py-0.5 text-[10.5px] font-medium text-surface hover:opacity-90"
												>
													<Icon name="send" className="size-3" />
													{t("inject.applyInChat")}
												</button>
											)}
											{/* 卸载：摘掉标记块，块外内容不动；不可用目标不给按钮。 */}
											{blocked ? null : (
												<button
													type="button"
													onClick={() =>
														copy(renderRemovalScript(planFor(item, { packLabel: packId, body: body ?? "" }), shell), t("inject.copied"))
													}
													className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-3 hover:bg-surface-hover hover:text-risk-high"
												>
													<Icon name="ban" className="size-3" />
													{t("inject.remove")}
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</Card>

					<Card
						title={plan && target ? `${target.label} · ${t(`inject.layer.${plan.layer}`)}` : t("inject.targets.title")}
						actions={
							plan && target && target.form !== "unavailable" ? (
								<>
									<button
										type="button"
										onClick={() => copy(renderInstaller(plan, shell), t("inject.copied"))}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 hover:bg-surface-hover hover:text-text"
									>
										<Icon name="copy" className="size-3" />
										{t("inject.copy")}
									</button>
									<button
										type="button"
										onClick={() =>
											copy(applyCommand(shell, scriptPathFor(target.id, shell)).display, t("inject.commandCopied"))
										}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 hover:bg-surface-hover hover:text-text"
									>
										<Icon name="play" className="size-3" />
										{t("inject.copyCommand")}
									</button>
									<button
										type="button"
										onClick={() => copy(renderRestoreScript(plan, shell), t("inject.copied"))}
										className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 hover:bg-surface-hover hover:text-text"
									>
										<Icon name="refresh" className="size-3" />
										{t("inject.copyRestore")}
									</button>
								</>
							) : undefined
						}
						bodyClassName="p-0"
						fill
					>
						{failure ? (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{failure}</div>
						) : !plan || !target ? (
							<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("docs.index.loading")}</div>
						) : target.form === "unavailable" ? (
							<div className="px-3.5 py-6 text-[11.5px] leading-relaxed text-text-4">
								<div className="mb-1 font-medium text-text-2">{t("inject.form.unavailable")}</div>
								{target.note ?? t("inject.unavailableHint")}
							</div>
						) : (
							<div className="fb-scroll fb-fill-scroll overflow-y-auto px-3.5 py-3 text-[11.5px] leading-relaxed">
								<div className="mb-2 flex flex-wrap items-center gap-1.5">
									<span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-text-3">
										{t(`inject.form.${target.form}`)}
									</span>
									<span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-text-3">
										{t(`inject.layer.${plan.layer}`)}
									</span>
									{target.note ? <span className="text-[10px] text-text-4">{target.note}</span> : null}
								</div>

								<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-4">{t("inject.writes")}</div>
								<table className="mb-3 w-full border-collapse text-left text-[11px]">
									<thead className="bg-surface-3">
										<tr>
											<th className="border-b border-line-subtle px-2 py-1 font-semibold text-text">path</th>
											<th className="border-b border-line-subtle px-2 py-1 font-semibold text-text">kind</th>
										</tr>
									</thead>
									<tbody>
										{plan.writes.map(write => (
											<tr key={`${write.path}-${write.kind}`}>
												<td className="break-all border-b border-line-subtle px-2 py-1 font-mono text-[10.5px] text-text-2">{write.path}</td>
												<td className="border-b border-line-subtle px-2 py-1 text-text-3">{write.kind}</td>
											</tr>
										))}
									</tbody>
								</table>

								<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-4">{t("inject.steps")}</div>
								<ol className="mb-3 flex list-decimal flex-col gap-1 pl-5 text-text-2">
									{plan.steps.map(step => (
										<li key={step}>{step}</li>
									))}
								</ol>

								<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-4">{t("inject.restore")}</div>
								<ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-text-3">
									{plan.restore.map(step => (
										<li key={step}>{step}</li>
									))}
								</ul>

								{plan.warnings.length > 0 ? (
									<>
										<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-risk-medium">{t("inject.warnings")}</div>
										<ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-text-3">
											{plan.warnings.map(warning => (
												<li key={warning}>{warning}</li>
											))}
										</ul>
									</>
								) : null}

								<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-text-4">{t("inject.command")}</div>
								<pre className="mb-2 overflow-x-auto rounded-md border border-line-subtle bg-surface px-2.5 py-1.5 font-mono text-[10.5px] text-text-2">
									{applyCommand(shell, scriptPathFor(target.id, shell)).display}
								</pre>

								{body === null ? (
									<div className="text-[10.5px] text-text-4">{t("docs.index.loading")}</div>
								) : (
									<details className="mt-2">
										<summary className="cursor-pointer text-[10.5px] text-text-3">{t("inject.previewScript")}</summary>
										<pre className="fb-scroll mt-1.5 max-h-64 overflow-auto rounded-md border border-line-subtle bg-surface p-2.5 font-mono text-[10px] leading-relaxed text-text-2">
											{renderInstaller(plan, shell)}
										</pre>
									</details>
								)}
							</div>
						)}
					</Card>
				</div>
			</div>
		</>
	);
}
