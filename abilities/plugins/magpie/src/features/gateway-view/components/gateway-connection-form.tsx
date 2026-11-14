import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController } from "../../../controller";
import { Button, Card, Field } from "./ui";

interface ConnectionFormProps {
	controller: GatewayController;
	disabled: boolean;
}

/**
 * 连接设置：网关地址与 key。
 *
 * 值全在 controller 里，这一层只在「正在编辑」时持有草稿；失焦或回车才提交，
 * 免得每敲一个字符就重新探一次网关。
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

	return (
		<Card
			title={t("settings.title")}
			aside={
				<span className="text-[11px] text-muted-foreground">
					{saved ? t("settings.saved") : dirty ? t("settings.unsaved") : null}
				</span>
			}
		>
			<div className="grid gap-3">
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
			<div className="mt-3 flex justify-end">
				<Button size="sm" onClick={commit} disabled={disabled || !dirty}>
					{t("settings.save")}
				</Button>
			</div>
		</Card>
	);
}
