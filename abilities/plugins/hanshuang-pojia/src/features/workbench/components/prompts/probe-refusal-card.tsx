import { useTranslation } from "@astravia-org/plugin-sdk";
import { Fragment, useState } from "react";
import {
	adviceFor,
	buildProbeBrief,
	customLadder,
	profileReady,
	probesFor,
	rewritesFor,
	type HostModelSnapshot,
	type ProbeProfile,
	type ProbeRecord,
	type RefusalProbe,
} from "../../../../domain/refusal-probe";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";

export interface ProbeRefusalCardProps {
	record: ProbeRecord | null;
	/** 宿主当前模型（provider / id / api 风格）。端点读不到，见 domain 注释。 */
	hostModel: HostModelSnapshot | null;
	/** 要测谁：端点 / 模型 / 风格 / 语言 / 档数。面板持有，非机密。 */
	profile: ProbeProfile;
	patchProfile(patch: Partial<ProbeProfile>): void;
	/** 把简报交给宿主对话执行（面板没有凭据，也不该有）。 */
	onBrief(brief: string): void;
	/** 把当前对照表交给对话，继续分析。 */
	onDiscuss(): void;
	refresh(): void;
}

const VERDICT_TONE: Record<string, string> = {
	answered: "text-risk-low",
	refused: "text-risk-high",
	filtered: "text-risk-medium",
	empty: "text-risk-medium",
};

const VERDICT_KEY: Record<string, string> = {
	answered: "probe.verdict.answered",
	refused: "probe.verdict.refused",
	filtered: "probe.verdict.filtered",
	empty: "probe.verdict.empty",
};

/**
 * 拒答梯度对照 —— 面板里的一等公民功能。
 *
 * 它不是「一张表」，而是一整套闭环：
 *
 *  1. **先说要测谁**（probe profile）。端点 / 模型 / 请求风格 / 语言 / 档数。不存密钥：
 *     面板存了它就会进渲染进程与 localStorage，拼进对话就会永久留在记录里。
 *  2. **选梯度**。标准四档回答「第几档开始拦」；自定义梯度回答「我这句话会不会被拦」
 *     —— 后者才是日常真正卡住人的问题。
 *  3. **交宿主 AI 执行**。面板不发请求（它没有凭据），而是把一份自包含的简报交给对话：
 *     参数、要看哪些字段、结果要什么形状都写进去，所以宿主不需要追问。
 *  4. **读结果**。表格给「期望 / 判定 / 命中类」，因为第 3、4 档被拦是常态而不是故障。
 *  5. **改写法再测**。每条被拦的档位都能展开成三档可发送的改写文本，按同一档重测，
 *     并把结论与上一份记录对比 —— 「改了有没有用」是这套功能唯一要回答的问题。
 */
export function ProbeRefusalCard({ record, hostModel, profile, patchProfile, onBrief, onDiscuss, refresh }: ProbeRefusalCardProps) {
	const { t } = useTranslation();
	const [ladder, setLadder] = useState<"standard" | "custom">("standard");
	const [custom, setCustom] = useState("");
	// 展开哪一档的改写。同时只开一条：改写文本很长，全展开就没法比对。
	const [rewriteFor, setRewriteFor] = useState<number | null>(null);

	const ready = profileReady(profile);
	const rungs: readonly RefusalProbe[] = ladder === "custom" ? customLadder(custom) : probesFor(profile.lang, profile.level === 0 ? undefined : profile.level);
	const advice = record ? adviceFor(record.rows) : [];
	const actionable = advice.filter(item => item.tiers.length > 0);
	const rejected = record?.rows.filter(row => row.verdict !== "answered") ?? [];
	const current = rewriteFor === null ? null : rejected.find(row => row.probe.level === rewriteFor);
	const previous = record?.previous;

	const run = () => onBrief(buildProbeBrief(profile, ladder === "custom" ? { custom } : {}));

	return (
		<Card
			title={t("probe.title")}
			actions={
				<>
					<button
						type="button"
						onClick={refresh}
						title={t("probe.refreshHint")}
						aria-label={t("probe.refreshHint")}
						className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="refresh" className="size-3" />
					</button>
					<button
						type="button"
						onClick={run}
						disabled={!ready || rungs.length === 0}
						title={ready ? undefined : t("probe.needProfile")}
						className="rounded-md bg-text px-2 py-0.5 text-[10.5px] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40"
					>
						{t("probe.run")}
					</button>
				</>
			}
			bodyClassName="p-0"
		>
			{/* ① 要测谁：表单式两列，窄面板自动降单列。 */}
			<div className="border-b border-line-subtle px-3 py-2">
				{/* 宿主当前模型：能自动读到的三项先填好，用户只剩端点要填。 */}
				{hostModel ? (
					<div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-md bg-surface-3/60 px-2 py-1">
						<span className="shrink-0 text-[10.5px] text-text-4">{t("probe.host.detected")}</span>
						<span className="min-w-0 flex-1 fb-wrap font-mono text-[10.5px] text-text-2">
							{hostModel.provider} / {hostModel.id}
							<span className="ms-1 text-text-4">· {hostModel.apiStyle}</span>
						</span>
						<button
							type="button"
							onClick={() =>
								patchProfile({ model: hostModel.id, apiStyle: hostModel.apiStyle, authHeader: hostModel.apiStyle === "anthropic" ? "x-api-key" : "Authorization" })
							}
							className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent transition-colors hover:brightness-110"
						>
							{t("probe.host.use")}
						</button>
					</div>
				) : null}
				<div className="pb-1 text-[9.5px] uppercase tracking-wider text-text-4">{t("probe.profile.title")}</div>
				<div className="grid gap-1.5 @min-[420px]:grid-cols-2">
					<label className="fb-field">
						<span className="fb-field-label">{t("probe.profile.base")}</span>
						<input
							value={profile.baseUrl}
							onChange={event => patchProfile({ baseUrl: event.target.value })}
							placeholder="https://api.example.com/v1"
							className="fb-field-value w-full rounded-md border border-line-subtle bg-surface px-2 py-1 font-mono text-[11.5px] text-text outline-none focus:border-accent"
						/>
					</label>
					<label className="fb-field">
						<span className="fb-field-label">{t("probe.profile.model")}</span>
						<input
							value={profile.model}
							onChange={event => patchProfile({ model: event.target.value })}
							placeholder={t("probe.profile.modelPlaceholder")}
							className="fb-field-value w-full rounded-md border border-line-subtle bg-surface px-2 py-1 font-mono text-[11.5px] text-text outline-none focus:border-accent"
						/>
					</label>
				</div>
				<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
					{(["openai", "anthropic"] as const).map(style => (
						<button
							key={style}
							type="button"
							aria-pressed={profile.apiStyle === style}
							onClick={() => patchProfile({ apiStyle: style, authHeader: style === "anthropic" ? "x-api-key" : "Authorization" })}
							className={`rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors ${
								profile.apiStyle === style ? "bg-accent-soft text-accent" : "text-text-3 hover:bg-surface-hover"
							}`}
						>
							{t(`probe.style.${style}`)}
						</button>
					))}
					<span className="text-text-4">·</span>
					{(["zh", "en"] as const).map(lang => (
						<button
							key={lang}
							type="button"
							aria-pressed={profile.lang === lang}
							onClick={() => patchProfile({ lang })}
							className={`rounded-md px-1.5 py-0.5 text-[10.5px] uppercase transition-colors ${
								profile.lang === lang ? "bg-accent-soft text-accent" : "text-text-3 hover:bg-surface-hover"
							}`}
						>
							{lang}
						</button>
					))}
					<span className="text-text-4">·</span>
					{ladder === "standard" ? (
						<label className="flex items-center gap-1 text-[10.5px] text-text-3">
							{t("probe.profile.level")}
							<input
								type="number"
								min={1}
								max={4}
								value={profile.level === 0 ? 4 : profile.level}
								onChange={event => patchProfile({ level: Number(event.target.value) || 4 })}
								className="w-10 rounded border border-line-subtle bg-surface px-1 py-0.5 text-center font-mono text-[10.5px] text-text outline-none focus:border-accent"
							/>
						</label>
					) : null}
				</div>
				{ready ? null : <p className="mt-1 text-[10.5px] leading-relaxed text-risk-medium">{t("probe.needProfile")}</p>}
				{/* 密钥不在这里：写进来就会进对话记录。 */}
				<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t("probe.profile.keyNote")}</p>
				{/* 端点为什么必须手填一次：SDK 不给，说了才不像是漏做。 */}
				<p className="mt-0.5 text-[10.5px] leading-relaxed text-text-4">{t("probe.host.note")}</p>
			</div>

			{/* ② 选梯度 */}
			<div className="border-b border-line-subtle px-3 py-2">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-[9.5px] uppercase tracking-wider text-text-4">{t("probe.ladder.title")}</span>
					{(["standard", "custom"] as const).map(kind => (
						<button
							key={kind}
							type="button"
							aria-pressed={ladder === kind}
							onClick={() => setLadder(kind)}
							className={`rounded-md px-1.5 py-0.5 text-[10.5px] transition-colors ${
								ladder === kind ? "bg-accent-soft text-accent" : "text-text-3 hover:bg-surface-hover"
							}`}
						>
							{t(`probe.ladder.${kind}`)}
						</button>
					))}
					<span className="ms-auto font-mono text-[9.5px] text-text-4">{rungs.length}</span>
				</div>
				{ladder === "custom" ? (
					<>
						<textarea
							value={custom}
							onChange={event => setCustom(event.target.value)}
							rows={3}
							placeholder={t("probe.ladder.customPlaceholder")}
							className="mt-1.5 w-full resize-y rounded-md border border-line-subtle bg-surface px-2 py-1 font-mono text-[10.5px] leading-relaxed text-text outline-none focus:border-accent"
						/>
						{/* 存下来的梯度：每次重打一遍整段话是这套功能最实际的摩擦点。 */}
						<div className="mt-1 flex flex-wrap items-center gap-1">
							<span className="text-[9.5px] uppercase tracking-wider text-text-4">{t("probe.ladder.saved")}</span>
							{(profile.savedLadders ?? []).map(entry => (
								<span key={entry.name} className="inline-flex items-center gap-0.5 rounded border border-line-subtle">
									<button
										type="button"
										onClick={() => setCustom(entry.text)}
										title={entry.text}
										className="rounded-s px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
									>
										{entry.name}
									</button>
									<button
										type="button"
										aria-label={t("probe.ladder.remove")}
										title={t("probe.ladder.remove")}
										onClick={() =>
											patchProfile({ savedLadders: (profile.savedLadders ?? []).filter(item => item.name !== entry.name) })
										}
										className="rounded-e border-s border-line-subtle px-1 py-0.5 text-[10.5px] text-text-4 hover:text-risk-high"
									>
										×
									</button>
								</span>
							))}
							<button
								type="button"
								disabled={custom.trim().length === 0}
								onClick={() => {
									const text0 = custom.trim();
									if (!text0) return;
									const name = text0.split(/\r?\n/)[0]?.trim().slice(0, 24) || `${(profile.savedLadders ?? []).length + 1}`;
									const kept = (profile.savedLadders ?? []).filter(item => item.name !== name);
									patchProfile({ savedLadders: [...kept, { name, text: text0 }] });
								}}
								className="rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
							>
								{t("probe.ladder.save")}
							</button>
						</div>
					</>
				) : (
					<ol className="mt-1.5 space-y-0.5">
						{rungs.map(rung => (
							<li key={rung.level} className="flex min-w-0 items-baseline gap-1.5 text-[10.5px] text-text-3">
								<span className="shrink-0 font-mono text-text-4">{rung.level}</span>
								<span className="min-w-0 flex-1 fb-wrap">{rung.name}</span>
								<span className="shrink-0 text-[9.5px] text-text-4">{t(`probe.expect.${rung.expect}`)}</span>
							</li>
						))}
					</ol>
				)}
			</div>

			{record === null ? (
				<div className="px-3 py-3">
					<p className="text-[11.5px] leading-relaxed text-text-3">{t("probe.empty")}</p>
					<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t("probe.emptyHint")}</p>
					{/* 「测出来的结果显示在哪儿」是这套功能最常被问的一句，直接写在空态里。 */}
					<p className="mt-1.5 rounded-md bg-surface-3/60 px-2 py-1 text-[10.5px] leading-relaxed text-text-3">
						<span className="font-medium text-text-2">{t("probe.where.title")}</span> {t("probe.where.body")}
					</p>
				</div>
			) : (
				<>
					<div className="flex flex-wrap items-baseline gap-2 border-b border-line-subtle px-3 py-2 text-[10.5px]">
						<span className="font-mono text-text-2">{record.model}</span>
						<span className="text-text-4">·</span>
						<span className="fb-wrap font-mono text-text-4">{record.host}</span>
						<span className="text-text-4">·</span>
						<span className="text-text-4">{record.at.slice(0, 19).replace("T", " ")}</span>
						<span className="min-w-0 flex-1 fb-wrap text-end text-text-2">{record.summary.headline}</span>
					</div>

					{previous ? (
						// 与上次对比：改了写法再测，唯一要回答的就是这一行。
						<div className="flex flex-wrap items-center gap-1.5 border-b border-line-subtle bg-surface-3/50 px-3 py-1.5 text-[10.5px]">
							<span className="shrink-0 text-text-4">{t("probe.compare")}</span>
							{(previous.firstRefusal ?? 99) <= (record.summary.firstRefusal ?? 99) ? (
								<span className="fb-wrap text-risk-high">
									{t("probe.compare.worse", { prev: previous.firstRefusal ?? "—", now: record.summary.firstRefusal ?? "—" })}
								</span>
							) : (
								<span className="fb-wrap text-risk-low">
									{t("probe.compare.better", { prev: previous.firstRefusal ?? "—", now: record.summary.firstRefusal ?? "—" })}
								</span>
							)}
						</div>
					) : null}

					{/* 表格区自己滚：笔记本矮屏下不再把卡片下半截顶出界面。 */}
					<div className="fb-scroll m-2 max-h-[var(--fb-h-sm)] overflow-auto rounded-lg ring-1 ring-line-subtle">
						{advice.length === 0 ? (
							// 有记录但一条都没拿到可判定的回复（全部请求失败）：不能渲染空表，那看起来像被裁了。
							<div className="px-3 py-4 text-[10.5px] leading-relaxed text-text-4">{t("probe.rowsEmpty")}</div>
						) : (
							<table className="w-full border-collapse text-left text-[11.5px]">
								<thead className="bg-surface-3">
									<tr>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.level")}</th>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.probe")}</th>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.expect")}</th>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.verdict")}</th>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.kind")}</th>
										<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.advice")}</th>
									</tr>
								</thead>
								<tbody>
									{advice.map(item => {
										const row = rejected.find(entry => entry.probe.level === item.level);
										const open = rewriteFor === item.level;
										return (
											// key 挂在 Fragment 上：map 的返回值必须有 key。
											<Fragment key={item.level}>
												<tr className="even:bg-surface-2">
													<td className="border-b border-line-subtle px-2.5 py-1 font-mono tabular-nums text-text-2">{item.level}</td>
													{/* 用记录里的档位名：标准四档与自定义梯度都自带名字，按数字取 locale
													    只对标准档成立（自定义档会显示成标准档的名字）。 */}
													<td className="border-b border-line-subtle px-2.5 py-1 text-text-2" title={row?.probe.text}>
														{row?.probe.name ?? t(`probe.level.${item.level}`)}
													</td>
													{/* 期望列：第 3、4 档本来就可能被拦；没有它，读者会把「如预期」当故障。 */}
													<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] text-text-4">
														{row ? t(`probe.expect.${row.probe.expect}`) : "—"}
													</td>
													<td className={`border-b border-line-subtle px-2.5 py-1 font-medium ${VERDICT_TONE[item.verdict]}`}>
														{t(VERDICT_KEY[item.verdict])}
													</td>
													<td className="border-b border-line-subtle px-2.5 py-1 font-mono text-[9.5px] text-text-3">{item.kind ?? "—"}</td>
													<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] leading-relaxed text-text-3">
														{item.tiers.length > 0 && row ? (
															<span className="flex flex-wrap items-center gap-1">
																<span className="fb-wrap">{item.note}</span>
																<button
																	type="button"
																	aria-expanded={open}
																	onClick={() => setRewriteFor(open ? null : item.level)}
																	className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent transition-colors hover:brightness-110"
																>
																	{open ? t("probe.rewrite.hide") : t("probe.rewrite.show")}
																</button>
															</span>
														) : (
															item.note
														)}
													</td>
												</tr>
												{open && current ? (
													<tr className="bg-accent-soft/40">
														<td colSpan={6} className="border-b border-line-subtle px-2.5 py-2">
															<div className="flex flex-wrap items-center gap-2 pb-1">
																<span className="text-[10.5px] font-medium text-text-2">{t("probe.rewrite.title")}</span>
																{rewritesFor(current.probe.text).map(option => (
																	<button
																		key={option.tier}
																		type="button"
																		onClick={() => onBrief(buildProbeBrief(profile, { retest: option.text }))}
																		title={option.text}
																		className="rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
																	>
																		{t(`probe.reshape.${option.tier}`)} · {t("probe.rewrite.retest")}
																	</button>
																))}
															</div>
															<pre className="fb-wrap max-h-[var(--fb-h-xs)] overflow-auto whitespace-pre-wrap break-words font-mono text-[9.5px] leading-relaxed text-text-3">
																{rewritesFor(current.probe.text)[0]?.text ?? ""}
															</pre>
														</td>
													</tr>
												) : null}
											</Fragment>
										);
									})}
								</tbody>
							</table>
						)}
					</div>

					{/* 拒答措施：从记录里读，不重新推导 —— 措施是那次探测的结论之一。 */}
					<div className="border-t border-line-subtle px-3 py-2">
						<div className="flex items-baseline gap-1.5">
							<span className="text-[9.5px] uppercase tracking-wider text-text-4">{t("probe.counter.title")}</span>
							<span className="min-w-0 flex-1 fb-wrap text-[10.5px] text-text-4">{t("probe.counter.hint")}</span>
						</div>
						{(record.advice ?? []).filter(item => item.verdict !== "answered").length === 0 ? (
							<p className="mt-1 text-[10.5px] text-text-3">{t("probe.counter.none")}</p>
						) : (
							<ul className="mt-1 space-y-0.5">
								{(record.advice ?? [])
									.filter(item => item.verdict !== "answered")
									.map(item => {
										const row = record.rows.find(entry => entry.probe.level === item.level);
										return (
										<li key={item.level} className="flex min-w-0 items-baseline gap-1.5 text-[10.5px]">
											<span className="shrink-0 font-mono text-text-4">{item.level}</span>
											<span className="min-w-0 flex-1 fb-wrap text-text-2">
												{/* 被拦的是哪一句：自定义梯度下这是用户自己的话，必须能对上。 */}
												{row ? <span className="me-1 font-mono text-[9.5px] text-text-4">{row.probe.text.slice(0, 60)}</span> : null}
												{item.note}
											</span>
											{item.tiers.length > 0 ? (
												<span className="shrink-0 font-mono text-[9.5px] text-accent">{item.tiers.join(" → ")}</span>
											) : null}
										</li>
										);
									})}
							</ul>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-3 py-2">
						<span className="text-[10.5px] text-text-4">{t("probe.advice.count", { count: actionable.length })}</span>
						<button
							type="button"
							onClick={onDiscuss}
							className="ml-auto inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							<Icon name="send" className="size-3" />
							{t("probe.discuss")}
						</button>
					</div>
				</>
			)}
		</Card>
	);
}
