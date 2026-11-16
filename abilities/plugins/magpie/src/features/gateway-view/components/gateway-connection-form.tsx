import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController } from "../../../controller";
import { Button, Field, PanelSection } from "./ui";

interface ConnectionFormProps {
	controller: GatewayController;
	disabled: boolean;
}

/**
 * 连接：网关地址与 key。
 *
 * 值全在 controller 里，这一层只在「正在编辑」时持有草稿；失焦或回车才提交，
 * 免得每敲一个字符就重新探一次网关。两栏在宽处并排 —— 它们都是「这台网关」，同一节。
 */
export function GatewayConnectionForm({ controller, disabled }: ConnectionFormProps) {
	const { t } = useTranslation();
	const settings = controller.getSettings();
	const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
	const [apiKey, setApiKey] = useState(settings.apiKey);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		setBaseUrl(settings.baseUrl);
		setApiKey(settings.apiKey);
	}, [settings.baseUrl, settings.apiKey]);

	const dirty = baseUrl !== settings.baseUrl || apiKey !== settings.apiKey;

	const commit = (): void => {
		if (!dirty) return;
		void controller.updateSettings({ baseUrl, apiKey }).then(() => {
			setSaved(true);
			window.setTimeout(() => setSaved(false), 1600);
		});
	};

	const note = saved ? t("settings.saved") : dirty ? t("settings.unsaved") : null;

	return (
		<PanelSection
			title={t("settings.title")}
			aside={
				<span className="flex items-center gap-1.5">
					{note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
					<Button size="sm" tone={dirty ? "primary" : "outline"} onClick={commit} disabled={disabled || !dirty}>
						{t("settings.save")}
					</Button>
				</span>
			}
		>
			<div className="grid gap-2.5 @sm:grid-cols-2">
				<Field
					label={t("settings.baseUrl")}
					hint={t("settings.baseUrlHint")}
					value={baseUrl}
					disabled={disabled}
					onChange={(event) => setBaseUrl(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter") commit();
					}}
				/>
				<Field
					label={t("settings.apiKey")}
					hint={t("settings.apiKeyHint")}
					type="password"
					autoComplete="off"
					value={apiKey}
					disabled={disabled}
					onChange={(event) => setApiKey(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter") commit();
					}}
				/>
			</div>
		</PanelSection>
	);
}
