import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, Input } from "@astravia-org/ui";
import { useEffect, useState } from "react";

interface ConnectionFormProps {
	baseUrl: string;
	apiKey: string;
	disabled: boolean;
	onSave: (patch: { baseUrl: string; apiKey: string }) => void;
}

/**
 * 连接设置：网关地址 + 网关密钥。
 * 两个都是「改了就重探」的输入，因此不在输入过程中保存，只在按钮上提交。
 */
export function GatewayConnectionForm({ baseUrl, apiKey, disabled, onSave }: ConnectionFormProps) {
	const { t } = useTranslation();
	const [draftUrl, setDraftUrl] = useState(baseUrl);
	const [draftKey, setDraftKey] = useState(apiKey);

	// 外部（读盘 / 规范化）改了值就同步回来，避免用户看到的是旧地址。
	useEffect(() => setDraftUrl(baseUrl), [baseUrl]);
	useEffect(() => setDraftKey(apiKey), [apiKey]);

	const dirty = draftUrl !== baseUrl || draftKey !== apiKey;

	return (
		<section className="rounded-xl border border-border/70 bg-card/60 p-5">
			<h2 className="text-sm font-medium">{t("settings.title")}</h2>
			<div className="mt-3 grid gap-3 sm:grid-cols-2">
				<label className="block">
					<span className="text-xs text-muted-foreground">{t("settings.baseUrl")}</span>
					<Input
						value={draftUrl}
						onChange={(event) => setDraftUrl(event.target.value)}
						spellCheck={false}
						className="mt-1 h-8 font-mono text-xs"
					/>
					<span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
						{t("settings.baseUrlHint")}
					</span>
				</label>
				<label className="block">
					<span className="text-xs text-muted-foreground">{t("settings.apiKey")}</span>
					<Input
						value={draftKey}
						onChange={(event) => setDraftKey(event.target.value)}
						spellCheck={false}
						className="mt-1 h-8 font-mono text-xs"
					/>
					<span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
						{t("settings.apiKeyHint")}
					</span>
				</label>
			</div>
			<div className="mt-3">
				<Button
					size="sm"
					variant="outline"
					disabled={disabled || !dirty}
					onClick={() => onSave({ baseUrl: draftUrl, apiKey: draftKey })}
				>
					{t("settings.save")}
				</Button>
			</div>
		</section>
	);
}
