import { useTranslation } from "@astravia-org/plugin-sdk";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";

/**
 * 成员胶囊行最右一格。宿主那格是团队设置，本插件没有设置页（ADR-0105），
 * 于是放凭证状态：点开就地展开激活面板（ADR 0011 §2.2）。
 */
export function CredentialChip({
	entitlement,
	onOpen,
}: {
	entitlement: EntitlementState;
	onOpen(): void;
}) {
	const { t } = useTranslation();
	const active = entitlement.status === "active";

	return (
		<button
			type="button"
			onClick={onOpen}
			title={t("roster.credentialHint")}
			className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
				active
					? "border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					: "border-destructive/40 bg-destructive/15 text-destructive"
			}`}
		>
			{t(active ? "roster.credentialActive" : "roster.credentialInactive")}
		</button>
	);
}
