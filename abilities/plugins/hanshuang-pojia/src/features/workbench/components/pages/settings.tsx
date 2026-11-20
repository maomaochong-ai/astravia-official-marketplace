/**
 * 面板「设置」页：规则级别、当前生效提示词、默认项与实验环境开关。
 *
 * 显示的是**真实状态**（含存储读失败时的回退），不缓存出一份「看起来开着」的副本。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import { RULES, type Severity } from "../../../../domain/audit/rules";
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
import type { PageProps } from "./overview";

const MODES = ["summary", "full"] as const;
const ORDER: readonly Severity[] = ["critical", "high", "medium", "low", "info"];

/** 设置页：模式、规则开关、扫描参数、持久化。规则开关会真的改变评分。 */
export function SettingsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { settings, updateSettings, lab, promptLibrary, cwd } = model;
	const activePrompt = getActivePrompt(promptLibrary);

	const runtimeRows = [
		{
			key: "lab",
			label: t("settings.runtime.lab"),
			value: lab.state.enabled ? t("lab.on") : t("panel.offline.title"),
			tone: lab.state.enabled ? "text-risk-low" : "text-text-4",
		},
		{
			key: "prompt",
			label: t("settings.runtime.prompt"),
			value: activePrompt?.name ?? t("settings.runtime.none"),
			tone: activePrompt ? "text-purple" : "text-text-4",
		},
		{
			key: "workspace",
			label: t("settings.runtime.workspace"),
			value: cwd ?? t("settings.runtime.none"),
			tone: cwd ? "text-text-2" : "text-risk-medium",
		},
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
	// 占用逐项问宿主，不估算：用户看到的是真实文件数与字节数。
	const [usage, setUsage] = useState<StorageUsageRow[] | null>(null);
	const loadUsage = () => {
		void model.storageUsage().then(setUsage);
	};
	useEffect(loadUsage, []);
	const clear = async (scope: "session" | "workspace" | "all") => {
		const done = await model.clearStorage(scope);
		setClearState(done ? "settings.data.cleared" : "settings.data.clearFailed");
		loadUsage();
	};

	const sortValue = (severity: Severity) => ORDER.indexOf(severity);

	return (
		<>
			<PageHeader
				title={t("page.settings.title")}
				description={t("page.settings.lead")}
				actions={
					<button
						type="button"
						onClick={reset}
						className="rounded border border-line-subtle px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("settings.reset")}
					</button>
				}
			/>
			<div className="fb-page">
				<div className="px-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("settings.group.runtime")}</div>
				{/* 实验环境开关的完整控制在这里；顶栏只留一个快捷开关。 */}
				<Card title={t("settings.lab.title")} bodyClassName="flex flex-col gap-2 p-3.5">
					<div className="flex items-start gap-2.5">
						<div className="min-w-0 flex-1">
							<div className="text-[11.5px] font-medium text-text">{t("settings.lab.label")}</div>
							<p className="mt-0.5 text-[10.5px] leading-relaxed text-text-3">{t("settings.lab.hint")}</p>
							<p className="mt-1 font-mono text-[10px] text-text-4">
								{lab.state.since ? t("settings.lab.since", { at: lab.state.since.slice(0, 19).replace("T", " ") }) : t("settings.lab.never")}
							</p>
						</div>
						<Toggle checked={lab.state.enabled} onChange={value => lab.set(value)} label={t("settings.lab.label")} hideLabel />
					</div>
				</Card>

				<Card title={t("settings.runtime.title")} bodyClassName="divide-y divide-line-subtle">
					{runtimeRows.map(row => (
						<div key={row.key} className="flex items-baseline gap-2 px-3.5 py-2">
							<span className="w-16 shrink-0 text-[10.5px] text-text-4">{row.label}</span>
							<span className={`min-w-0 flex-1 truncate text-[11.5px] ${row.tone}`} title={row.value}>
								{row.value}
							</span>
						</div>
					))}
				</Card>

				<div className="px-1 pt-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("settings.group.analysis")}</div>
				<Card title={t("settings.mode.title")} bodyClassName="p-3.5">
					<div className="flex gap-2">
						{MODES.map(mode => {
							const active = settings.mode === mode;
							return (
								<button
									key={mode}
									type="button"
									onClick={() => updateSettings({ mode })}
									aria-pressed={active}
									className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
										active ? "border-line-strong bg-surface-4" : "border-line-subtle bg-surface hover:bg-surface-hover"
									}`}
								>
									<div className="flex items-center gap-1.5">
										<Icon name={active ? "check" : "scan"} className={`size-3.5 ${active ? "text-risk-low" : "text-text-4"}`} />
										<span className="text-[12px] font-medium text-text">{t(`mode.${mode}`)}</span>
									</div>
									<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t(`settings.mode.${mode}`)}</p>
								</button>
							);
						})}
					</div>
					<p className="mt-2 text-[10px] leading-relaxed text-text-4">{t("settings.mode.note")}</p>
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
					{[...RULES]
						.sort((left, right) => sortValue(left.severity) - sortValue(right.severity))
						.map(rule => {
							const enabled = !settings.disabledRules.includes(rule.id);
							return (
								<div key={rule.id} className="flex items-start gap-2.5 px-3.5 py-2">
									<span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[rule.severity]}`} />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span className="truncate text-[11.5px] text-text">{t(`rule.${rule.id}.title`)}</span>
											<span className={`shrink-0 font-mono text-[9.5px] ${SEVERITY_TEXT[rule.severity]}`}>{rule.severity}</span>
										</div>
										<div className="truncate font-mono text-[9.5px] text-text-4">{rule.id}</div>
									</div>
									<Toggle checked={enabled} onChange={() => toggleRule(rule.id)} label={t(`rule.${rule.id}.title`)} hideLabel />
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

				<div className="px-1 pt-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("settings.group.storage")}</div>
				<Card title={t("settings.storage.title")} bodyClassName="divide-y divide-line-subtle">
					<Toggle
						checked={settings.persistLibrary}
						onChange={value => updateSettings({ persistLibrary: value })}
						label={t("settings.storage.persist")}
						hint={t("settings.storage.persistHint")}
					/>
					<div className="px-3.5 py-2.5">
						<div className="flex items-start gap-2">
							<Icon
								name={model.persisted ? "check" : "alert"}
								className={`mt-0.5 size-3.5 shrink-0 ${model.persisted ? "text-risk-low" : "text-risk-medium"}`}
							/>
							<p className="text-[10.5px] leading-relaxed text-text-3">
								{model.persisted ? t("settings.storage.granted") : t("settings.storage.missing")}
							</p>
						</div>
					</div>
					<div className="px-3.5 py-2.5">
						<p className="text-[10px] leading-relaxed text-text-4">{t("settings.about")}</p>
					</div>
				</Card>

				{/* 插件到底写了什么：路径直接列出来，不用用户去猜宿主把它藏在哪儿。 */}
				<Card title={t("settings.data.title")} bodyClassName="divide-y divide-line-subtle">
					<div className="px-3.5 py-2">
						<p className="text-[10.5px] leading-relaxed text-text-3">{t("settings.data.lead")}</p>
					</div>
					{(usage ?? []).map(row => (
						<div key={row.key} className="flex items-baseline gap-2 px-3.5 py-1.5">
							<span className="w-24 shrink-0 text-[10px] text-text-4">
								{t(`settings.data.scope.${row.scope}`)}
							</span>
							<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2" title={row.path}>
								{row.path}
							</span>
							<span className="shrink-0 tabular-nums text-[10px] text-text-4">
								{row.unavailable
									? t("settings.data.unavailable")
									: t("settings.data.usage", { files: row.files, size: formatBytes(row.bytes) })}
							</span>
						</div>
					))}
					{usage === null ? <div className="px-3.5 py-1.5 text-[10px] text-text-4">{t("settings.data.loading")}</div> : null}
					{/* usage 为空但模型已经返回：只可能是存储整体不可用，按 storageEntries 的路径列出来更诚实。 */}
					{(usage ?? []).length === 0
						? storageEntries(model.cwd, model.sessionId).map(entry => (
								<div key={entry.key} className="flex items-baseline gap-2 px-3.5 py-1.5">
									<span className="w-24 shrink-0 text-[10px] text-text-4">{t(`settings.data.scope.${entry.scope}`)}</span>
									<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2" title={entry.path}>
										{entry.path}
									</span>
								</div>
							))
						: null}
					<div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
						<button
							type="button"
							onClick={() => void clear("session")}
							className="rounded-md border border-line-subtle px-2.5 py-1.5 text-[11px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							{t("settings.data.clearSession")}
						</button>
						<button
							type="button"
							onClick={() => void clear("workspace")}
							className="rounded-md border border-line-subtle px-2.5 py-1.5 text-[11px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							{t("settings.data.clearProducts")}
						</button>
						<button
							type="button"
							onClick={() => void clear("all")}
							className="rounded-md border border-risk-high/40 bg-risk-high/10 px-2.5 py-1.5 text-[11px] font-medium text-risk-high transition-colors hover:bg-risk-high/15"
						>
							{t("settings.data.clearAll")}
						</button>
						{clearState ? <span className="text-[10.5px] text-text-4">{t(clearState)}</span> : null}
					</div>
				</Card>
			</div>
		</>
	);
}
