import { useTranslation } from "@astravia-org/plugin-sdk";
import type { EntitlementState } from "../../../entitlement/verify-entitlement.js";

/**
 * 成员胶囊行最右一格。宿主那格是团队设置，本插件没有设置页（ADR-0105），
 * 于是放凭证状态：点开就地展开激活面板（ADR 0011 §2.2）。
 *
 * 与成员胶囊同高同圆角，用 10px 等宽字：它是一枚状态签，不是按钮，
 * 视觉上要落在成员那一行的元信息层里。未激活时才升到警示层。
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
			className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 font-mono text-[10px] transition-colors ${
				active
					? "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
					: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
			}`}
		>
			<span
				aria-hidden="true"
				className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-destructive"}`}
			/>
			{t(active ? "roster.credentialActive" : "roster.credentialInactive")}
		</button>
	);
}
