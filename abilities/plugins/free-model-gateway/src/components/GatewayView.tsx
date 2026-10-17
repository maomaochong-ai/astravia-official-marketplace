import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import { useCallback, useEffect, useState, type ChangeEvent, type JSX } from "react";
import type { GatewayController, GatewayState } from "../controller";

/**
 * 工作区视图：状态卡 + 操作 + 自启设置 + 日志折叠 + 队列说明。
 *
 * 视图本身无状态机——一切服务/同步状态都来自 controller 的广播；这里只持有
 * 自启开关草稿与日志折叠的本地 UI 状态。自包含形态下用户无需配置任何路径
 * 或密钥：服务 zip 随插件分发，forwardKey 由服务自己写盘、插件自动读取。
 */

const PHASE_TONE: Record<GatewayState["phase"], string> = {
	idle: "text-muted-foreground",
	installing: "text-primary",
	starting: "text-primary",
	running: "text-emerald-500",
	stopping: "text-muted-foreground",
	error: "text-destructive",
};

export function GatewayView({ controller }: { controller: GatewayController }): JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<GatewayState>(controller.getState());
	const [autoStart, setAutoStart] = useState(controller.getSettings().autoStart);
	const [savedFlash, setSavedFlash] = useState(false);
	const [output, setOutput] = useState("");
	const [outputOpen, setOutputOpen] = useState(false);

	useEffect(() => {
		const subscription = controller.subscribe(setState);
		return () => subscription.dispose();
	}, [controller]);
	useEffect(() => {
		setAutoStart(controller.getSettings().autoStart);
	}, [controller]);

	const busy = state.busy;
	const running = state.phase === "running";

	const save = useCallback(async () => {
		await controller.updateSettings({ autoStart });
		setSavedFlash(true);
		setTimeout(() => setSavedFlash(false), 1500);
	}, [controller, autoStart]);

	const refreshOutput = useCallback(async () => {
		setOutput(await controller.recentOutput());
	}, [controller]);

	const openOutput = useCallback(async () => {
		setOutputOpen((open) => !open);
		void refreshOutput();
	}, [refreshOutput]);

	const onAutoStartToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setAutoStart(event.target.checked);
	}, []);

	return (
		<div className="relative flex h-full w-full flex-1 flex-col overflow-y-auto bg-background">
			<div className="drag-region h-6 shrink-0" />

			<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-10">
				{/* ── 状态卡 ─────────────────────────────────────────── */}
				<section className="rounded-xl border border-border/70 bg-card/60 p-5">
					<div className="flex items-center gap-3">
						<span
							className={cn(
								"icon-[solar--server-square-cloud-linear] h-5 w-5 shrink-0",
								PHASE_TONE[state.phase],
							)}
						/>
						<h1 className={cn("text-[16px] font-semibold", PHASE_TONE[state.phase])}>
							{t(`status.${state.phase}`)}
						</h1>
						{state.messageKey ? (
							<span className="truncate text-[12px] text-destructive/80">{t(state.messageKey)}</span>
						) : null}
						{savedFlash ? (
							<span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">{t("settings.saved")}</span>
						) : null}
					</div>

					<dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1.5 text-[12px] text-muted-foreground">
						{state.baseUrl ? (
							<div className="flex gap-1.5">
								<dt>{t("status.baseUrl")}</dt>
								<dd className="font-mono text-foreground">{state.baseUrl}</dd>
							</div>
						) : null}
						{state.modelCount !== undefined ? (
							<div className="flex gap-1.5">
								<dt>{t("status.modelCount")}</dt>
								<dd className="font-mono text-foreground">{state.modelCount}</dd>
							</div>
						) : (
							<div className="flex gap-1.5">
								<dt>{t("status.modelCount")}</dt>
								<dd className="font-mono text-muted-foreground/70">—</dd>
							</div>
						)}
						{state.syncedAt ? (
							<div className="flex gap-1.5">
								<dt>{t("status.syncedAt")}</dt>
								<dd className="font-mono text-foreground">
									{new Date(state.syncedAt).toLocaleTimeString()}
								</dd>
							</div>
						) : null}
					</dl>

					<div className="mt-4 flex flex-wrap items-center gap-2">
						{running ? (
							<>
								<Button variant="outline" disabled={busy} onClick={() => void controller.stop()}>
									{t("actions.stop")}
								</Button>
								<Button variant="outline" disabled={busy} onClick={() => void controller.syncModels()}>
									{t("actions.resync")}
								</Button>
								<Button variant="ghost" onClick={() => void controller.openManagement()}>
									{t("actions.openManagement")}
								</Button>
							</>
						) : (
							<Button
								disabled={busy}
								onClick={() => void controller.ensureRunning()}
							>
								{busy ? t("actions.working") : t("actions.start")}
							</Button>
						)}
					</div>
				</section>

				{/* ── 设置 ───────────────────────────────────────────── */}
				<section className="rounded-xl border border-border/70 bg-card/60 p-5">
					<h2 className="text-[13px] font-semibold text-foreground">{t("settings.title")}</h2>
					<label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[12px] text-foreground">
						<input
							type="checkbox"
							checked={autoStart}
							onChange={onAutoStartToggle}
							className="h-3.5 w-3.5 accent-(--color-primary)"
						/>
						{t("settings.autoStart")}
					</label>
					<p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
						{t("settings.autoStartHint")}
					</p>
					<div className="mt-3">
						<Button variant="outline" onClick={() => void save()}>
							{t("settings.save")}
						</Button>
					</div>
				</section>

				{/* ── 日志折叠 ───────────────────────────────────────── */}
				<section className="rounded-xl border border-border/70 bg-card/60 p-5">
					<button
						type="button"
						onClick={() => void openOutput()}
						className="flex items-center gap-2 text-[12px] font-semibold text-foreground"
					>
						<span
							className={cn(
								"icon-[solar--alt-arrow-down-linear] h-3.5 w-3.5 transition-transform",
								outputOpen ? "rotate-180" : "rotate-0",
							)}
						/>
						{t("actions.output")}
					</button>
					{outputOpen ? (
						<div className="mt-3 flex flex-col gap-2">
							<div>
								<Button variant="ghost" onClick={() => void refreshOutput()}>
									{t("actions.outputRefresh")}
								</Button>
							</div>
							<pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
								{output || "—"}
							</pre>
						</div>
					) : null}
				</section>

				{/* ── 使用说明 ───────────────────────────────────────── */}
				<section className="rounded-xl border border-border/70 bg-card/60 p-4">
					<div className="flex items-start gap-2">
						<span className="icon-[solar--info-circle-linear] mt-px h-4 w-4 shrink-0 text-primary/80" />
						<div>
							<h2 className="text-[12px] font-semibold text-foreground">{t("usage.title")}</h2>
							<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("usage.body")}</p>
						</div>
					</div>
				</section>

				{/* ── 风险声明 ───────────────────────────────────────── */}
				<section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
					<div className="flex items-start gap-2">
						<span className="icon-[solar--danger-triangle-linear] mt-px h-4 w-4 shrink-0 text-destructive/80" />
						<div>
							<h2 className="text-[12px] font-semibold text-foreground">{t("disclaimer.title")}</h2>
							<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("disclaimer.body")}</p>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
