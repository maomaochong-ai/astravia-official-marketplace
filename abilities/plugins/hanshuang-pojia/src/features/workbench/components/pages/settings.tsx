/**
 * 面板「设置」页：两栏 —— 左边是分组菜单，右边只渲染当前分组的卡。
 *
 * 为什么改成两栏：之前六张卡竖着排成一条长页，面板一矮就只能看到分组标题，
 * 卡体被挤没（用户看到的是「只有标题、内容不生效」）。现在右侧自己滚、
 * 一次只占一屏，且每个分组都有独立入口，不再需要往下翻找。
 *
 * 显示的是**真实状态**（含存储读失败时的回退），不缓存出一份「看起来开着」的副本。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import { RULES, type Severity } from "../../../../domain/audit/rules";
import type { ReportMode } from "../../../../domain/report/report";
import { getActivePrompt } from "../../../../domain/prompt-library";
import { DEFAULT_SETTINGS } from "../../state";
import { SEVERITY_DOT, SEVERITY_TEXT } from "../../severity";
import { Card } from "../shell/card";
import { formatBytes } from "../../../../domain/report/report";
import { storageEntries } from "../../../../domain/storage-layout";
import type { StorageUsageRow } from "../../hooks/use-workbench";
import { Icon } from "../shell/icon";
import { NumberField } from "../shell/number-field";
import { PageHeader } from "../shell/page-header";
import { Toggle } from "../shell/toggle";
import { SegmentedControl } from "../shell/segmented-control";
import type { PageProps } from "./overview";

const MODES = ["summary", "full"] as const;
const ORDER: readonly Severity[] = ["critical", "high", "medium", "low", "info"];
const TABS = ["runtime", "analysis", "storage", "data"] as const;
type Tab = (typeof TABS)[number];

/** 设置页：模式、规则开关、扫描参数、持久化。规则开关会真的改变评分。 */
export function SettingsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { settings, updateSettings, lab, promptLibrary, cwd } = model;
	const activePrompt = getActivePrompt(promptLibrary);
	const [tab, setTab] = useState<Tab>("runtime");

	const runtimeRows = [
		{ key: "prompt", label: t("settings.runtime.prompt"), value: activePrompt?.name ?? t("settings.runtime.none"), tone: activePrompt ? "text-accent" : "text-text-4" },
		{ key: "workspace", label: t("settings.runtime.workspace"), value: cwd ?? t("settings.runtime.none"), tone: cwd ? "text-text-2" : "text-risk-medium" },
	];

	const toggleRule = (id: string) => {
		const disabled = settings.disabledRules.includes(id);
		updateSettings({
			disabledRules: disabled ? settings.disabledRules.filter(rule => rule !== id) : [...settings.disabledRules, id],
		});
	};

	const reset = () => updateSettings({ ...DEFAULT_SETTINGS });

	// 清理结果只留一行提示：删文件是副作用，不需要弹窗打断。
	const [clearState, setClearState] = useState<string | null>(null);
	// 破坏性动作统一用「点一次武装、5 秒收回」，与活动页清空、提示词删除同一套形态。
	// 原生 confirm 会阻断渲染进程，样式也跟不了主题。
	const [armed, setArmed] = useState<string | null>(null);
	useEffect(() => {
		if (!armed) return;
		const timer = window.setTimeout(() => setArmed(null), 5_000);
		return () => window.clearTimeout(timer);
	}, [armed]);
	/** 需要确认的动作：第一次调用只武装，第二次才执行。 */
	const confirmThen = (key: string, run: () => void) => {
		if (armed !== key) {
			setArmed(key);
			return;
		}
		setArmed(null);
		run();
	};
	// 占用逐项问宿主，不估算：用户看到的是真实文件数与字节数。
	const [usage, setUsage] = useState<StorageUsageRow[] | null>(null);
	/**
	 * 勾选的条目（storage key）。空 = 没选。
	 *
	 * 清理会删文件，所以两段式：先勾，再按一次「清理选中」。范围按钮保留，因为它们回答
	 * 另一种问题（「这个会话全清掉」），勾选回答「就删这三项」。
	 */
	const [selected, setSelected] = useState<string[]>([]);
	const loadUsage = () => {
		void model.storageUsage().then(setUsage);
	};
	useEffect(loadUsage, []);
	/** 按条目清理：把勾中的 storage key 展开成真实路径（含旧位置）再删。 */
	const clearKeys = async (keys: readonly string[]) => {
		if (keys.length === 0) return;
		const paths = storageEntries(model.cwd, model.sessionId)
			.filter(entry => keys.includes(entry.key))
			.flatMap(entry => (entry.legacyPath ? [entry.path, entry.legacyPath] : [entry.path]));
		const done = paths.length > 0 ? await model.clearPaths(paths) : false;
		setClearState(done ? "settings.data.cleared" : "settings.data.clearFailed");
		setSelected([]);
		loadUsage();
	};

	const clear = async (scope: "session" | "workspace" | "all") => {
		const done = await model.clearStorage(scope);
		setClearState(done ? "settings.data.cleared" : "settings.data.clearFailed");
		loadUsage();
	};


	return (
		<>
			<PageHeader
				title={t("page.settings.title")}
				description={t("page.settings.lead")}
				actions={
					<button
						type="button"
						aria-pressed={armed === "reset"}
						onClick={() => confirmThen("reset", reset)}
						className={`rounded-md border px-2 py-1 text-[11.5px] transition-colors ${armed === "reset" ? "border-risk-high/40 bg-risk-high/10 text-risk-high" : "border-line-subtle text-text-2 hover:bg-surface-hover hover:text-text"}`}
					>
						{armed === "reset" ? t("settings.resetArmed") : t("settings.reset")}
					</button>
				}
			/>
			{/*
			 * 两栏：左 tab、右卡片。宽度由 CSS 类 `.fb-settings` 给，不用容器查询 ——
			 * 面板是活动栏里的一格，容器查询的参照宽度常常不是用户看到的那个，
			 * 于是会「该两栏却堆在顶部」。四项各三个字，竖着放永远放得下。
			 */}
			<div className="fb-page fb-settings">
				{/* 左：分组菜单。窄面板变成一行横向标签，不用另做一套交互。 */}
				<nav
					role="tablist"
					aria-orientation="vertical"
					aria-label={t("page.settings.title")}
					className="fb-settings-tabs flex shrink-0 flex-col gap-0.5 border-e border-line-subtle pe-1"
				>
					{TABS.map(item => (
						<button
							key={item}
							type="button"
							onClick={() => setTab(item)}
							role="tab"
							aria-selected={tab === item}
							data-testid={`settings-tab-${item}`}
							className={`fb-settings-tab w-full shrink-0 rounded-md px-2.5 py-1.5 text-left text-[11.5px] transition-colors ${
								tab === item ? "bg-accent-soft font-medium text-accent" : "text-text-2 hover:bg-surface-hover hover:text-text"
							}`}
						>
							{t(`settings.group.${item}`)}
						</button>
					))}
				</nav>

				{/* 右：当前分组的卡；自己滚，卡不被挤压。 */}
				<div
					role="tabpanel"
					aria-label={t(`settings.group.${tab}`)}
					className="fb-scroll flex min-h-0 flex-col gap-2.5 overflow-y-auto ps-3"
				>
					{/* 内容限宽：规则行拉到 900px 时，开关离标签太远，看串行。 */}
					<div className="fb-settings-body">
					{tab === "runtime" ? (
						<>
							<Card title={t("settings.lab.title")} bodyClassName="flex flex-col gap-2 p-3.5">
								<div className="flex items-start gap-2.5">
									<div className="min-w-0 flex-1">
										<div className="text-[11.5px] font-medium text-text">{t("settings.lab.label")}</div>
										<p className="mt-0.5 text-[10.5px] leading-relaxed text-text-3">{t("settings.lab.hint")}</p>
										<p className="mt-1 font-mono text-[10.5px] text-text-4">
											{lab.state.since ? t("settings.lab.since", { at: lab.state.since.slice(0, 19).replace("T", " ") }) : t("settings.lab.never")}
										</p>
									</div>
									<Toggle checked={lab.state.enabled} onChange={value => lab.set(value)} label={t("settings.lab.label")} hideLabel />
								</div>
							</Card>

							<Card title={t("settings.runtime.title")} bodyClassName="divide-y divide-line-subtle">
								{runtimeRows.map(row => (
									<div key={row.key} className="flex items-baseline gap-2 px-3.5 py-2">
										<span className="w-14 shrink-0 text-[10.5px] text-text-4">{row.label}</span>
										<span className={`min-w-0 flex-1 break-all text-[11.5px] ${row.tone}`} title={row.value}>
											{row.value}
										</span>
									</div>
								))}
							</Card>
						</>
					) : null}

					{tab === "analysis" ? (
						<>
							{/* 二选一用分段控件：两张等宽大卡把 8 个字的选项摊成半屏，读起来比选项本身更重。 */}
							<Card title={t("settings.mode.title")} bodyClassName="flex flex-col gap-2 p-3.5">
								<SegmentedControl<ReportMode>
									value={settings.mode}
									onValueChange={mode => updateSettings({ mode })}
									ariaLabel={t("settings.mode.title")}
									items={MODES.map(mode => ({ value: mode, label: t(`mode.${mode}`) }))}
								/>
								<p className="text-[10.5px] leading-relaxed text-text-3">{t(`settings.mode.${settings.mode}`)}</p>
								<p className="text-[10.5px] leading-relaxed text-text-4">{t("settings.mode.note")}</p>
							</Card>

							<Card
								title={t("settings.rules.title")}
								actions={
									<span className="text-[10.5px] text-text-4">
										{t("settings.rules.off", { count: settings.disabledRules.length, total: RULES.length })}
									</span>
								}
								bodyClassName="divide-y divide-line-subtle"
							>
								{/*
								 * 37 条规则平铺成一张长表时，读者只能一条条扫；按严重度分组后
								 * 「高危有几条、关了几条」直接读得出来 —— 而开关本来就是按级别决定的。
								 */}
								{ORDER.map(severity => {
									const group = RULES.filter(rule => rule.severity === severity).sort((left, right) =>
										left.id.localeCompare(right.id),
									);
									if (group.length === 0) return null;
									const off = group.filter(rule => settings.disabledRules.includes(rule.id)).length;
									return (
										<div key={severity}>
											<div className="sticky top-0 z-1 flex items-center gap-2 bg-surface-2/95 px-3.5 py-1.5 backdrop-blur">
												<span className={`size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`} />
												<span className={`text-[10.5px] font-medium ${SEVERITY_TEXT[severity]}`}>{t(`severity.${severity}`)}</span>
												<span className="font-mono text-[9.5px] tabular-nums text-text-4">
													{group.length - off}/{group.length}
												</span>
											</div>
											{group.map(rule => {
												const enabled = !settings.disabledRules.includes(rule.id);
												return (
													<div key={rule.id} className="flex items-start gap-2.5 px-3.5 py-2">
														<div className="min-w-0 flex-1">
															<div className="min-w-0 text-[11.5px] leading-snug text-text">{t(`rule.${rule.id}.title`)}</div>
															<div className="fb-wrap font-mono text-[9.5px] text-text-4">{rule.id}</div>
														</div>
														<Toggle checked={enabled} onChange={() => toggleRule(rule.id)} label={t(`rule.${rule.id}.title`)} hideLabel />
													</div>
												);
											})}
										</div>
									);
								})}
							</Card>

							<Card title={t("settings.scan.title")} bodyClassName="divide-y divide-line-subtle">
								<NumberField
									label={t("strings.minLength")}
									hint={t("settings.scan.minLength")}
									value={settings.stringsMinLength}
									min={4}
									max={24}
									onChange={value => updateSettings({ stringsMinLength: value })}
								/>
								<NumberField
									label={t("strings.limit")}
									hint={t("settings.scan.limit")}
									value={settings.stringsLimit}
									min={50}
									max={2000}
									step={50}
									onChange={value => updateSettings({ stringsLimit: value })}
								/>
								<NumberField
									label={t("entropy.bucketCount")}
									hint={t("settings.scan.buckets")}
									value={settings.entropyBuckets}
									min={8}
									max={60}
									onChange={value => updateSettings({ entropyBuckets: value })}
								/>
							</Card>
						</>
					) : null}

					{tab === "storage" ? (
						<Card title={t("settings.storage.title")} bodyClassName="divide-y divide-line-subtle">
							<Toggle
								checked={settings.persistLibrary}
								onChange={value => updateSettings({ persistLibrary: value })}
								label={t("settings.storage.persist")}
								hint={t("settings.storage.persistHint")}
							/>
							<div className="flex items-start gap-2 px-3.5 py-2.5">
								<Icon
									name={model.persisted ? "check" : "alert"}
									className={`mt-0.5 size-3.5 shrink-0 ${model.persisted ? "text-risk-low" : "text-risk-medium"}`}
								/>
								<p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">
									{model.persisted ? t("settings.storage.granted") : t("settings.storage.missing")}
								</p>
							</div>
							<p className="px-3.5 py-2.5 text-[10.5px] leading-relaxed text-text-4">{t("settings.about")}</p>
						</Card>
					) : null}

					{tab === "data" ? (
						<Card title={t("settings.data.title")} bodyClassName="divide-y divide-line-subtle">
							<div className="px-3.5 py-2">
								<p className="text-[10.5px] leading-relaxed text-text-3">{t("settings.data.lead")}</p>
							</div>
							{(usage ?? []).map(row => (
								<div key={row.key} className="flex items-baseline gap-2 px-3.5 py-1.5">
									{/* 勾选：条目是语义的（一件事一行），不是文件名。 */}
									<input
										type="checkbox"
										checked={selected.includes(row.key)}
										onChange={() =>
											setSelected(current =>
												current.includes(row.key) ? current.filter(key => key !== row.key) : [...current, row.key],
											)
										}
										aria-label={t("settings.data.select", { key: row.key })}
										className="mt-[3px] size-3 shrink-0 accent-[var(--risk-high)]"
									/>
									<span className="w-20 shrink-0 text-[10.5px] text-text-4">{t(`settings.data.scope.${row.scope}`)}</span>
									<span className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-snug text-text-2" title={row.path}>
										{row.path}
									</span>
									<span className="shrink-0 tabular-nums text-[10.5px] text-text-4">
										{row.unavailable ? t("settings.data.unavailable") : t("settings.data.usage", { files: row.files, size: formatBytes(row.bytes) })}
									</span>
								</div>
							))}
							{usage === null ? <div className="px-3.5 py-1.5 text-[10.5px] text-text-4">{t("settings.data.loading")}</div> : null}
							{/* usage 为空但模型已经返回：只可能是存储整体不可用，按 storageEntries 的路径列出来更诚实。 */}
							{(usage ?? []).length === 0
								? storageEntries(model.cwd, model.sessionId).map(entry => (
										<div key={entry.key} className="flex items-baseline gap-2 px-3.5 py-1.5">
											<span className="w-20 shrink-0 text-[10.5px] text-text-4">{t(`settings.data.scope.${entry.scope}`)}</span>
											<span className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-snug text-text-2" title={entry.path}>
												{entry.path}
											</span>
										</div>
									))
								: null}
							<div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
								{/* 勾选式清理：只删勾中的条目。 */}
								<button
									type="button"
									disabled={selected.length === 0}
									onClick={() => void clearKeys(selected)}
									className="rounded-md border border-risk-high/40 bg-risk-high/10 px-2.5 py-1.5 text-[11.5px] font-medium text-risk-high transition-colors hover:bg-risk-high/15 disabled:opacity-40"
								>
									{t("settings.data.clearSelected", { count: selected.length })}
								</button>
								<button
									type="button"
									disabled={(usage ?? []).length === 0}
									onClick={() => setSelected((usage ?? []).map(row => row.key))}
									className="rounded-md border border-line-subtle px-2.5 py-1.5 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
								>
									{t("settings.data.selectAll")}
								</button>
								{selected.length > 0 ? (
									<button
										type="button"
										onClick={() => setSelected([])}
										className="rounded-md px-1.5 py-1.5 text-[11.5px] text-text-4 transition-colors hover:text-text"
									>
										{t("settings.data.selectNone")}
									</button>
								) : null}
								<span className="w-px self-stretch bg-line-subtle" aria-hidden />
								{/* 范围式清理保留：它回答「这一整档都清掉」。 */}
								{armed === null ? null : null}
								<button
									type="button"
									aria-pressed={armed === "session"}
									onClick={() => confirmThen("session", () => void clear("session"))}
									className={`rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${armed === "session" ? "border-risk-high/40 bg-risk-high/10 text-risk-high" : "border-line-subtle text-text-2 hover:bg-surface-hover hover:text-text"}`}
								>
									{armed === "session" ? t("settings.data.armed") : t("settings.data.clearSession")}
								</button>
								<button
									type="button"
									aria-pressed={armed === "workspace"}
									onClick={() => confirmThen("workspace", () => void clear("workspace"))}
									className={`rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${armed === "workspace" ? "border-risk-high/40 bg-risk-high/10 text-risk-high" : "border-line-subtle text-text-2 hover:bg-surface-hover hover:text-text"}`}
								>
									{armed === "workspace" ? t("settings.data.armed") : t("settings.data.clearProducts")}
								</button>
								<button
									type="button"
									aria-pressed={armed === "all"}
									onClick={() => confirmThen("all", () => void clear("all"))}
									className={`rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${armed === "all" ? "border-risk-high bg-risk-high text-surface" : "border-risk-high/40 bg-risk-high/10 text-risk-high hover:bg-risk-high/15"}`}
								>
									{armed === "all" ? t("settings.data.armedAll") : t("settings.data.clearAll")}
								</button>
								{clearState ? <span className="text-[10.5px] text-text-4">{t(clearState)}</span> : null}
							</div>
						</Card>
					) : null}
					</div>
				</div>
			</div>
		</>
	);
}
