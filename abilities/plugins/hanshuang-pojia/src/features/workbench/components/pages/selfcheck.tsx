import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo } from "react";
import { runEngineSelfCheck, type SelfCheckItem } from "../../../../domain/selfcheck";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

interface HostCheck {
	id: string;
	ok: boolean;
	detail: string;
}

/**
 * 自检页：引擎每一项都真跑一次；宿主能力只报告「此刻是否可用」。
 * jadx / apktool / radare2 不在插件进程里，面板不会假装能探测它们。
 */
export function SelfCheckPage({ model }: PageProps) {
	const { t } = useTranslation();
	const engine = useMemo<SelfCheckItem[]>(() => runEngineSelfCheck(), []);
	const failures = engine.filter(item => item.status === "fail").length;

	const host: HostCheck[] = [
		{ id: "host.cwd", ok: model.cwd !== null, detail: model.cwd ?? t("selfcheck.host.cwdMissing") },
		{ id: "host.storage", ok: model.persisted, detail: model.persisted ? t("selfcheck.host.storageOn") : t("selfcheck.host.storageOff") },
		{ id: "host.chat", ok: model.chat.state.status !== "disconnected", detail: model.chat.state.status === "disconnected" ? t("chat.state.disconnected") : t("chat.state.connected") },
		{ id: "host.limit", ok: true, detail: t("selfcheck.host.limit") },
	];

	return (
		<>
			<PageHeader
				title={t("page.selfcheck.title")}
				description={t("page.selfcheck.lead")}
				actions={<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />}
			/>
			<div className="space-y-3 p-4">
				<Card
					title={t("selfcheck.engine")}
					actions={<Tag tone={failures === 0 ? "low" : "high"}>{failures === 0 ? t("selfcheck.pass") : t("selfcheck.failed", { count: failures })}</Tag>}
					bodyClassName="divide-y divide-line-subtle"
				>
					{engine.map(item => (
						<div key={item.id} className="flex items-start gap-2.5 px-3.5 py-2">
							<Icon
								name={item.status === "pass" ? "check" : item.status === "warn" ? "alert" : "close"}
								className={`mt-0.5 size-3.5 shrink-0 ${item.status === "pass" ? "text-risk-low" : item.status === "warn" ? "text-risk-medium" : "text-risk-high"}`}
							/>
							<div className="min-w-0 flex-1">
								<div className="font-mono text-[11.5px] text-text">{t(`selfcheck.item.${item.id}`)}</div>
								<div className="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-text-4">{item.detail}</div>
							</div>
						</div>
					))}
				</Card>

				<Card title={t("selfcheck.host.title")} bodyClassName="divide-y divide-line-subtle">
					{host.map(item => (
						<div key={item.id} className="flex items-start gap-2.5 px-3.5 py-2">
							<Icon
								name={item.ok ? "check" : "ban"}
								className={`mt-0.5 size-3.5 shrink-0 ${item.ok ? "text-risk-low" : "text-risk-medium"}`}
							/>
							<div className="min-w-0 flex-1">
								<div className="text-[11.5px] text-text">{t(item.id)}</div>
								<div className="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-text-4">{item.detail}</div>
							</div>
						</div>
					))}
				</Card>

				<Card title={t("selfcheck.tools.title")} bodyClassName="p-3.5">
					<p className="text-[10.5px] leading-relaxed text-text-3">{t("selfcheck.tools.body")}</p>
					<div className="mt-2 flex items-center gap-2">
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={model.chat.sending} />
						<span className="text-[10px] text-text-4">{t("selfcheck.tools.hint")}</span>
					</div>
				</Card>
			</div>
		</>
	);
}
