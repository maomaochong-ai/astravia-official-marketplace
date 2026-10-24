import { useTranslation } from "@astravia-org/plugin-sdk";
import { RULES, type Severity } from "../../../../domain/audit/rules";
import { getActivePrompt } from "../../../../domain/prompt-library";
import { DEFAULT_SETTINGS, type WorkbenchSettings } from "../../state";
import { SEVERITY_DOT, SEVERITY_TEXT } from "../../severity";
import { Card } from "../shell/card";
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
						className="rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("settings.reset")}
					</button>
				}
			/>
			<div className="space-y-3 p-4">
				<div className="px-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("settings.group.runtime")}</div>
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
										active ? "border-line-strong bg-surface-4" : "border-line bg-surface hover:bg-surface-hover"
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
			</div>
		</>
	);
}

/** 供测试与页面复用的设置摘要。 */
export function settingsSummary(settings: WorkbenchSettings): string {
	return `${settings.mode} · ${settings.disabledRules.length} disabled`;
}
