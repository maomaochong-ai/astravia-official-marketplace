import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";
import { getStudioRuntime } from "../../../plugin-context.js";
import { ensureStudioView } from "../../../studio-view-registration.js";
import { ACTIVATION_VIEW_ID } from "../../../view-ids.js";
import { ActivationPanel } from "../../shared/components/ActivationPanel.js";

/**
 * 设置页里的激活入口（`sidebar: false`）。未激活时用户只能从这里进，
 * 激活成功后立刻补注册侧边栏工作台，不需要重启。
 */
export function ActivationWorkspaceView() {
	const runtime = getStudioRuntime();
	const { t } = useTranslation();
	const [entitlement, setEntitlement] = useState<EntitlementState>(runtime.service.entitlementState);

	useEffect(() => {
		runtime.ctx.ui.setWorkspaceViewHeader(ACTIVATION_VIEW_ID, { title: "%view.activation.label%" });
		return () => runtime.ctx.ui.setWorkspaceViewHeader(ACTIVATION_VIEW_ID, null);
	}, [runtime.ctx]);

	const active = entitlement.status === "active";

	return (
		<div className="mahua-root relative h-full overflow-y-auto">
			{active ? (
				<div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-6">
					<h1 className="text-base font-medium">{t("activation.activeTitle")}</h1>
					<p className="text-sm text-muted-foreground">
						{t("activation.activeBody", { subject: entitlement.claims.subject })}
					</p>
				</div>
			) : (
				<ActivationPanel
					entitlement={entitlement}
					keyIds={runtime.service.trustedKeys().map((key) => key.keyId)}
					onActivate={async (token) => {
						const next = await runtime.service.activate(token);
						setEntitlement(next);
						if (next.status === "active") ensureStudioView(runtime.ctx);
						return next;
					}}
				/>
			)}
		</div>
	);
}
