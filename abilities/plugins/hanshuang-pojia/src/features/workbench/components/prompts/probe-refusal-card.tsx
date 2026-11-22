import { useTranslation } from "@astravia-org/plugin-sdk";
import { Fragment, useEffect, useRef, useState } from "react";
import {
	adviceFor,
	buildProbeBrief,
	customLadder,
	followHostModel,
	profileReady,
	probesFor,
	probesForClass,
	rungRewrite,
	rewritesFor,
	type HostModelSnapshot,
	type ProbeProfile,
	type ProbeRecord,
	type RefusalProbe,
} from "../../../../domain/refusal-probe";
import { classLabel, shapeForLevel, shapeLabel, stepForLevel, targetClassOf } from "../../../../domain/probe-ladder";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";

export interface ProbeRefusalCardProps {
	record: ProbeRecord | null;
	/** 要测谁：端点 / 模型 / 风格 / 语言 / 档数。面板持有，非机密。 */
	profile: ProbeProfile;
	/** 宿主当前在用的模型（运行时每轮写、面板读）；null = 这个会话还没跑过一轮。 */
	hostModel?: HostModelSnapshot | null;
	patchProfile(patch: Partial<ProbeProfile>): void;
	/** 把简报交给宿主对话执行（面板没有凭据，也不该有）。 */
	onBrief(brief: string): void;
	/** 把当前对照表交给对话，继续分析。 */
	onDiscuss(): void;
	/**
	 * 宿主刚为哪一句自动派了一次梯度（来自 Stop hook 的 refusal 事件）。
	 *
	 * 拒绝之后插件会自动测一遍；面板要把这件事说出来，否则用户只看到表格突然多出几行，
	 * 不知道是谁在测。
	 */
	autoProbe?: { targetClass: string; rungs: number } | null;
	/** 对话里解析出来的实时对照（有则优先于文件记录）。 */
	live?: { model?: string; summary?: string; rows: { level: number; name?: string; verdict: string; kind?: string | null; text?: string; advice?: string }[] } | null;
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
export function ProbeRefusalCard({
	record,
	profile,
	hostModel = null,
	patchProfile,
	onBrief,
	onDiscuss,
	live = null,
	autoProbe = null,
	refresh,
}: ProbeRefusalCardProps) {
	const { t } = useTranslation();
	const [ladder, setLadder] = useState<"standard" | "custom">("standard");
	const [custom, setCustom] = useState("");
	// 展开哪一档的改写。同时只开一条：改写文本很长，全展开就没法比对。
	const [rewriteFor, setRewriteFor] = useState<number | null>(null);
	/** 某一档的改写草稿（用户可编辑后再发）。key = level。 */
	const [drafts, setDrafts] = useState<Record<number, string>>({});
	const draftFor = (level: number, source: string): string => drafts[level] ?? rungRewrite(source, level).text;

	/**
	 * 跟上宿主：换模型时自动把「要测谁」改成新的那个。
	 *
	 * 只在那一格还是自动填的时候（空 / 等于上一个宿主模型）才跟随 —— 用户自己敲过的值不动，
	 * 否则会把他正在对照的另一个端点静静换掉。判据在 `followHostModel`，有单测。
	 */
	const lastHost = useRef<string | null>(hostModel?.id ?? null);
	useEffect(() => {
		const next = hostModel?.id ?? null;
		if (lastHost.current === next) return;
		const before = lastHost.current;
		lastHost.current = next;
		if (!next) return;
		const followed = followHostModel(profile, before, next);
		if (followed.model !== profile.model) patchProfile(followed);
	}, [hostModel?.id, profile, patchProfile]);

	/**
	 * 首帧就把宿主模型填进去。
	 *
	 * 用户要的是「直接拿当前模型测」：第一次打开面板时那一格通常还是空的，让 effect 等一次
	 * 宿主模型变化才填，就等于要他先手动敲一遍。
	 */
	const seeded = useRef(false);
	useEffect(() => {
		if (seeded.current) return;
		if (!hostModel?.id) return;
		seeded.current = true;
		if (profile.model.trim().length > 0) return;
		patchProfile({
			model: hostModel.id,
			apiStyle: hostModel.apiStyle,
			authHeader: hostModel.apiStyle === "anthropic" ? "x-api-key" : "Authorization",
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hostModel?.id]);


	/**
	 * 表格的数据源。
	 *
	 * 有实时对照就用它（对话里刚发生的），否则用文件记录。两者都可能是空：
	 * `record === null` 且 `live === null` 时仍是空态，不假装有数据。
	 */
	const liveRows = live?.rows ?? [];
	/**
	 * 措施的统一样子：文件记录里的 advice 优先，其次 live 行自带的人话措施。
	 * `rewrite` 是可以直接发回对话的那句话 —— 落进 buildProbeBrief 的 retest 分支。
	 */
	const liveCounter: { level: number; blocked?: string; note: string; rewrite: string }[] = (() => {
		const fromRecord = (record?.advice ?? [])
			.filter(item => item.verdict !== "answered")
			.map(item => {
				const row = record?.rows.find(entry => entry.probe.level === item.level);
				const rewrites = row ? rewritesFor(row.probe.text) : [];
				return {
					level: item.level,
					blocked: row?.probe.text,
					note: item.note,
					rewrite: rewrites[0]?.text ?? row?.probe.text ?? "",
				};
			});
		if (fromRecord.length > 0) return fromRecord;
		return liveRows
			.filter(row => row.verdict !== "answered")
			.map(row => ({
				level: row.level,
				blocked: row.text,
				note: row.advice ?? row.name ?? String(row.verdict),
				rewrite: rewritesFor(row.text ?? row.advice ?? "")[0]?.text ?? row.advice ?? "",
			}));
	})();
	const ready = profileReady(profile);
	/**
	 * 梯度的来源。
	 *
	 * 自定义梯度按用户的行；标准梯度按**目标类别**（站点/接口/客户端/文件）生成 ——
	 * 固定的「概念→SQL 注入→本地许可→补丁」四档，对一句网站会员限制全不对题。
	 * 目标取「自定义梯度首行」或表里的 model/intent，找不到就退回通用四档。
	 */
	const targetBasis = (custom.trim() || liveRows[0]?.text || profile.model || "").trim();
	const rungs: readonly RefusalProbe[] =
		ladder === "custom"
			? customLadder(custom)
			: targetBasis.length > 0
				? probesForClass(targetBasis, profile.level === 0 ? undefined : profile.level)
				: probesFor(profile.lang, profile.level === 0 ? undefined : profile.level);
	const targetClass = classLabel(targetClassOf(targetBasis));
	const advice = record ? adviceFor(record.rows) : [];
	const actionable = advice.filter(item => item.tiers.length > 0);
	const rejected = record?.rows.filter(row => row.verdict !== "answered") ?? [];
	const current = rewriteFor === null ? null : rejected.find(row => row.probe.level === rewriteFor);
	const previous = record?.previous;

	/** 这一轮没有结论：表格仍然列出来，只是判定列写「未测」。 */
	const unrun = record === null && liveRows.length === 0;

	/** 一行对照。三种输入（记录 / 实时 / 还没跑）合成同一形状，表格只需一种渲染。 */
	interface TableRow {
		level: number;
		name: string;
		expect: "answer" | "risky" | null;
		verdict: string | null;
		kind: string | null;
		shape: string | null;
		note: string | null;
		tiers: readonly string[];
		text: string | null;
		step: string | null;
	}

	/*
	 * 行从哪来：
	 *   · 有记录 → 那次探测的每一档（含措施档位）；
	 *   · 只有实时对照（对话里刚跑的、还没落盘）→ live 行；
	 *   · 两者都没有 → 这一轮**要跑**的档位，判定留空。
	 * 上一版最后两种情况都落到「没有可判定的行」，表格因此看不见。
	 */
	const tableRows: TableRow[] =
		advice.length > 0
			? advice.map(item => {
					const row = rejected.find(entry => entry.probe.level === item.level);
					return {
						level: item.level,
						name: row?.probe.name ?? t(`probe.level.${item.level}`),
						expect: row?.probe.expect ?? null,
						verdict: item.verdict,
						kind: item.kind ?? null,
						shape: row ? rungRewrite(row.probe.text, row.probe.level).label : null,
						note: item.note,
						tiers: item.tiers,
						text: row?.probe.text ?? null,
						step: stepForLevel(item.level).step,
					};
				})
			: liveRows.length > 0
				? liveRows.map(row => ({
						level: row.level,
						name: row.name ?? t(`probe.level.${row.level}`),
						expect: null,
						verdict: row.verdict,
						kind: row.kind ?? null,
						shape: row.text ? rungRewrite(row.text, row.level).label : null,
						note: row.advice ?? null,
						tiers: [],
						text: row.text ?? null,
						step: stepForLevel(row.level).step,
					}))
				: rungs.map(rung => ({
						level: rung.level,
						name: rung.name,
						expect: rung.expect,
						verdict: null,
						kind: null,
						shape: shapeLabel(shapeForLevel(rung.level)),
						note: null,
						tiers: [],
						text: rung.text,
						step: stepForLevel(rung.level).step,
					}));

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
				{/*
				 * 宿主当前模型：运行时每轮写、面板读。
				 *
				 * 它就在表单上方而不是一句说明：用户要的是「拿当前模型直接测」，
				 * 所以先告诉他宿主在用哪个，再给一个按钮把它填进去。探测不到时也直说（这个会话还没跑过一轮），
				 * 而不是默默留空让人以为插件坏了。
				 */}
				<div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-md bg-surface-3/60 px-2 py-1">
					<span className="shrink-0 text-[10.5px] text-text-4">{t("probe.host.detected")}</span>
					{hostModel ? (
						<>
							<span className="min-w-0 flex-1 fb-wrap font-mono text-[10.5px] text-text-2" title={`${hostModel.provider} / ${hostModel.id}${hostModel.api ? ` · ${hostModel.api}` : ""}`}>
								{hostModel.provider} / {hostModel.id}
								<span className="ms-1 text-text-4">· {hostModel.apiStyle}</span>
							</span>
							{profile.model.trim() === hostModel.id ? (
								<span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">{t("probe.host.inUse")}</span>
							) : (
								<button
									type="button"
									onClick={() =>
										patchProfile({
											model: hostModel.id,
											apiStyle: hostModel.apiStyle,
											authHeader: hostModel.apiStyle === "anthropic" ? "x-api-key" : "Authorization",
										})
									}
									title={t("probe.host.useHint")}
									className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent transition-colors hover:brightness-110"
								>
									{t("probe.host.use")}
								</button>
							)}
						</>
					) : (
						<span className="min-w-0 flex-1 fb-wrap text-[10.5px] text-text-4">{t("probe.host.missing")}</span>
					)}
				</div>
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

			{/* 自动探测的状态条：谁在测、测几档。不占表格的位置 —— 数据还是从记录/对话来。 */}
			{autoProbe ? (
				<div className="flex items-center gap-1.5 border-t border-line-subtle bg-accent-soft/30 px-3 py-1.5 text-[10.5px] text-text-2">
					<Icon name="refresh" className="size-3 shrink-0" />
					<span className="min-w-0 flex-1 fb-wrap">
						{t("probe.auto.running", { cls: autoProbe.targetClass, count: autoProbe.rungs })}
					</span>
					<button
						type="button"
						onClick={refresh}
						className="shrink-0 rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("probe.auto.refresh")}
					</button>
				</div>
			) : null}

			{/*
			 * 来源行 + 对照表：**始终渲染**。
			 *
			 * 上一版把整块表格包在「有记录或有实时对照」里，于是两种最常见的场景看不到表：
			 *   · 刚打开、一次都没跑过；
			 *   · 只在对话里跑过（有实时对照、没落盘记录）—— 那张表当时还会显示「没有可判定的行」。
			 * 表格同时回答「测过什么」与「接下来测什么」，不该因为没数据就整块消失。
			 */}
			<div className="flex flex-wrap items-baseline gap-2 border-b border-line-subtle px-3 py-2 text-[10.5px]">
				<span className="shrink-0 rounded bg-surface-3 px-1 py-0.5 text-[9.5px] uppercase tracking-wider text-text-4">
					{unrun ? t("probe.source.none") : liveRows.length > 0 ? t("probe.source.conversation") : t("probe.source.record")}
				</span>
				<span className="font-mono text-text-2">{live?.model ?? record?.model ?? (profile.model.trim() || "—")}</span>
				{/* 记录来自另一个模型时明说：宿主换了模型，这份结论是上一个的。参数是**记录**那个模型。 */}
				{record && hostModel && record.model !== hostModel.id ? (
					<span className="rounded bg-risk-medium/10 px-1 py-0.5 text-[9.5px] text-risk-medium" title={t("probe.staleHint")}>
						{t("probe.stale", { model: record.model })}
					</span>
				) : null}
				{record ? (
					<>
						<span className="text-text-4">·</span>
						<span className="fb-wrap font-mono text-text-4">{record.host}</span>
						<span className="text-text-4">·</span>
						<span className="text-text-4">{record.at.slice(0, 19).replace("T", " ")}</span>
					</>
				) : null}
				{/* 对象类别：整张表的前提。这句目标属于哪一类，决定标准梯度怎么问。 */}
				<span
					className="shrink-0 rounded bg-surface-3 px-1 py-0.5 text-[9.5px] text-text-3"
					title={t("probe.col.targetHint")}
				>
					{t("probe.col.target")}：{targetClass}
				</span>
				<span className="min-w-0 flex-1 fb-wrap text-end text-text-2">{live?.summary ?? record?.summary.headline ?? ""}</span>
			</div>

			{previous && record ? (
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
			<div data-testid="probe-table" className="fb-scroll m-2 max-h-[var(--fb-h-sm)] overflow-auto rounded-lg ring-1 ring-line-subtle">
				{unrun ? (
					<div className="border-b border-line-subtle bg-surface-3/50 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-text-3">
						<span className="font-medium text-text-2">{t("probe.where.title")}</span> {t("probe.emptyHint")}
					</div>
				) : null}
				<table className="w-full border-collapse text-left text-[11.5px]">
					<thead className="bg-surface-3">
						<tr>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.level")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.probe")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.expect")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.verdict")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.kind")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.shape")}</th>
							<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.advice")}</th>
						</tr>
					</thead>
					<tbody>
						{tableRows.map(row => {
							const open = rewriteFor === row.level;
							return (
								// key 挂在 Fragment 上：map 的返回值必须有 key。
								<Fragment key={row.level}>
									<tr className="even:bg-surface-2" data-verdict={row.verdict ?? "pending"}>
										<td className="border-b border-line-subtle px-2.5 py-1 font-mono tabular-nums text-text-2">{row.level}</td>
										{/* 用梯度里的档位名：标准与自定义都自带名字，按数字取 locale 只对标准档成立。 */}
										<td
											className="border-b border-line-subtle px-2.5 py-1 text-text-2"
											title={row.step ? `${t("probe.col.step")}：${row.step}${row.text ? `\n${row.text}` : ""}` : undefined}
										>
											{row.name}
										</td>
										{/* 期望列：第 3、4 档本来就可能被拦；没有它，读者会把「如预期」当故障。 */}
										<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] text-text-4">
											{row.expect ? t(`probe.expect.${row.expect}`) : "—"}
										</td>
										<td className={`border-b border-line-subtle px-2.5 py-1 font-medium ${row.verdict ? (VERDICT_TONE[row.verdict] ?? "text-text-3") : "text-text-4"}`}>
											{row.verdict ? t(VERDICT_KEY[row.verdict] ?? "probe.verdict.pending") : t("probe.verdict.pending")}
										</td>
										<td className="border-b border-line-subtle px-2.5 py-1 font-mono text-[9.5px] text-text-3">{row.kind ?? "—"}</td>
										{/* 句式：这一档的问法。整列一个名字，就说明改写真的换了形状。 */}
										<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] text-text-3">{row.shape ?? "—"}</td>
										<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] leading-relaxed text-text-3">
											{row.tiers.length > 0 && row.text ? (
												<span className="flex flex-wrap items-center gap-1">
													<span className="fb-wrap">{row.note}</span>
													<button
														type="button"
														aria-expanded={open}
														onClick={() => setRewriteFor(open ? null : row.level)}
														className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent transition-colors hover:brightness-110"
													>
														{open ? t("probe.rewrite.hide") : t("probe.rewrite.show")}
													</button>
												</span>
											) : (
												(row.note ?? "—")
											)}
										</td>
									</tr>
									{open && current ? (
										<tr className="bg-accent-soft/40">
											<td colSpan={7} className="border-b border-line-subtle px-2.5 py-2">
												<div className="flex flex-wrap items-center gap-2 pb-1">
													<span className="text-[10.5px] font-medium text-text-2">{t("probe.rewrite.title")}</span>
													{/* 句式标签：这一档用的是哪种问法，切换即可看出「内容被拦」还是「句式被拦」。 */}
													<span className="rounded bg-surface-3 px-1 py-0.5 text-[9.5px] text-text-3">
														{rungRewrite(current.probe.text, current.probe.level).label}
													</span>
													<button
														type="button"
														onClick={() => setDrafts(prev => ({ ...prev, [current.probe.level]: rungRewrite(current.probe.text, current.probe.level).text }))}
														className="rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
													>
														{t("probe.rewrite.reset")}
													</button>
													<button
														type="button"
														onClick={() =>
															onBrief(
																buildProbeBrief(profile, {
																	retest: draftFor(current.probe.level, current.probe.text),
																}),
															)
														}
														className="ms-auto rounded bg-text px-1.5 py-0.5 text-[10.5px] font-medium text-surface transition-opacity hover:opacity-90"
													>
														{t("probe.rewrite.retest")}
													</button>
												</div>
												{/* 可编辑：改写是结论，用户往往要按自己的口径微调再发。 */}
												<textarea
													value={draftFor(current.probe.level, current.probe.text)}
													onChange={event =>
														setDrafts(prev => ({ ...prev, [current.probe.level]: event.target.value }))
													}
													rows={4}
													aria-label={t("probe.rewrite.title")}
													className="fb-wrap w-full resize-y rounded border border-line-subtle bg-surface px-2 py-1 font-mono text-[9.5px] leading-relaxed text-text-2 outline-none focus:border-accent"
												/>
											</td>
										</tr>
									) : null}
								</Fragment>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* 拒答措施：从记录里读，不重新推导 —— 措施是那次探测的结论之一。 */}
			<div className="border-t border-line-subtle px-3 py-2">
				<div className="flex items-baseline gap-1.5">
					<span className="text-[9.5px] uppercase tracking-wider text-text-4">{t("probe.counter.title")}</span>
					<span className="min-w-0 flex-1 fb-wrap text-[10.5px] text-text-4">{t("probe.counter.hint")}</span>
					{/* 手动批量：与自动第二阶段同一份改写文本，只是由用户按下去。 */}
					<button
						type="button"
						onClick={() => {
							const blocked = liveCounter.slice(0, 3);
							for (const item of blocked) onBrief(buildProbeBrief(profile, { retest: item.rewrite }));
						}}
						disabled={liveCounter.length === 0}
						title={t("probe.counter.retestAllHint")}
						className="shrink-0 rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
					>
						{t("probe.counter.retestAll")}
					</button>
				</div>
				{liveCounter.length === 0 ? (
					<p className="mt-1 text-[10.5px] text-text-3">{t("probe.counter.none")}</p>
				) : (
					<ul className="mt-1 space-y-0.5">
						{liveCounter.map(item => {
							const blockedText = item.blocked;
							return (
								<li key={item.level} className="flex min-w-0 items-baseline gap-1.5 text-[10.5px]">
									<span className="shrink-0 font-mono text-text-4">{item.level}</span>
									<span className="min-w-0 flex-1 fb-wrap text-text-2">
										{/* 被拦的是哪一句：自定义梯度下这是用户自己的话，必须能对上。 */}
										{blockedText ? <span className="me-1 font-mono text-[9.5px] text-text-4">{blockedText.slice(0, 60)}</span> : null}
										{item.note}
									</span>
									{/* 措施可以直接发回对话继续执行：可执行，而不只是可读。 */}
									<button
										type="button"
										onClick={() => onBrief(buildProbeBrief(profile, { retest: item.rewrite }))}
										title={item.rewrite}
										className="shrink-0 rounded border border-line-subtle px-1.5 py-0.5 text-[9.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
									>
										{t("probe.counter.send")}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{/**
			 * 「交给对话继续分析」固定在卡片底部，不随表格的有无消失。
			 *
			 * 它曾放在「有记录」分支里：刚打开、还没跑过任何一次时整条按钮不存在，用户以为功能被删了。
			 * 表格空着也能讨论——「我按这套梯度测了但没结果，帮我看」正是最常见的提问。
			 */}
			<div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-3 py-2">
				<span className="text-[10.5px] text-text-4">{t("probe.advice.count", { count: actionable.length })}</span>
				<button
					type="button"
					onClick={onDiscuss}
					title={t("probe.discussHint")}
					className="ms-auto inline-flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
				>
					<Icon name="send" className="size-3" />
					{t("probe.discuss")}
				</button>
			</div>
		</Card>
	);
}
