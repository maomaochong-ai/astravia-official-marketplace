import { useTranslation } from "@astravia-org/plugin-sdk";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { Tag } from "../shell/tag";
import type { PageProps } from "./overview";

/** 签名页：只报告清单里看到的 v1/v2/v3 方案，不解析证书、不验证摘要。 */
export function SignaturePage({ model }: PageProps) {
	const { t } = useTranslation();
	const report = model.report;
	const busy = model.chat.sending;
	const signature = report?.signature;

	if (!report) {
		return (
			<>
				<PageHeader title={t("page.signature.title")} description={t("page.signature.lead")} />
				<EmptyState icon="shield" title={t("empty.noReport.title")} body={t("empty.noReport.body")} />
			</>
		);
	}

	if (!signature) {
		return (
			<>
				<PageHeader title={t("page.signature.title")} description={t("page.signature.lead")} />
				<EmptyState icon="shield" title={t("signature.none.title")} body={t("signature.none.body")} />
			</>
		);
	}

	const schemes = [
		{ id: "v1", label: "JAR signing (v1)", enabled: signature.v1, detail: t("signature.v1.detail") },
		{ id: "v2", label: "APK Signature Scheme v2", enabled: signature.v2, detail: t("signature.v2.detail") },
		{ id: "v3", label: "APK Signature Scheme v3", enabled: signature.v3, detail: t("signature.v3.detail") },
	];

	return (
		<>
			<PageHeader
				title={t("page.signature.title")}
				description={t("page.signature.lead")}
				actions={<AiButton label={t("ai.verifySignature")} onClick={() => model.ask("signature")} busy={busy} />}
			/>
			<div className="space-y-3 p-4">
				<Card title={t("signature.schemes")} bodyClassName="divide-y divide-line-subtle">
					{schemes.map(scheme => (
						<div key={scheme.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
							<Icon
								name={scheme.enabled ? "check" : "ban"}
								className={`mt-0.5 size-3.5 shrink-0 ${scheme.enabled ? "text-risk-low" : "text-text-4"}`}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="truncate font-mono text-[11.5px] text-text">{scheme.label}</span>
									<Tag tone={scheme.enabled ? "low" : "neutral"}>{scheme.enabled ? t("signature.present") : t("signature.absent")}</Tag>
								</div>
								<p className="mt-0.5 text-[10.5px] leading-relaxed text-text-4">{scheme.detail}</p>
							</div>
						</div>
					))}
				</Card>

				<Card title={t("signature.schemeNames")} bodyClassName="px-3.5 py-2.5">
					{signature.schemes.length === 0 ? (
						<p className="text-[11px] text-text-4">{t("signature.noScheme")}</p>
					) : (
						<div className="flex flex-wrap gap-1.5">
							{signature.schemes.map(scheme => (
								<Tag key={scheme} tone="neutral">
									{scheme}
								</Tag>
							))}
						</div>
					)}
				</Card>

				<Card title={t("signature.limit.title")} bodyClassName="p-3.5">
					<p className="text-[10.5px] leading-relaxed text-text-3">{t("signature.limit.body")}</p>
					<p className="mt-1.5 text-[10.5px] leading-relaxed text-text-4">{t("signature.limit.how")}</p>
				</Card>
			</div>
		</>
	);
}
