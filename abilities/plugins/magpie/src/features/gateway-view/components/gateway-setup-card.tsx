import { useTranslation } from "@astravia-org/plugin-sdk";

interface SetupCardProps {
	endpoint: string;
}

const INSTALL_COMMAND = "curl -fsSL https://usemagpie.ai/install.sh | sh";

/**
 * 离线态的唯一职责：说清「网关是外部程序，你需要先把它跑起来」。
 * 插件不代劳安装或启动 —— 那是用户机器上的软件安装行为。
 */
export function GatewaySetupCard({ endpoint }: SetupCardProps) {
	const { t } = useTranslation();

	return (
		<section className="rounded-xl border border-border/70 bg-card/60 p-5">
			<h2 className="text-sm font-medium">{t("setup.title", { endpoint })}</h2>
			<p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("setup.body")}</p>
			<p className="mt-3 text-xs text-muted-foreground">{t("setup.installHint")}</p>
			<pre className="mt-2 overflow-x-auto rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-[11px]">
				{INSTALL_COMMAND}
			</pre>
			<a
				href="https://usemagpie.ai"
				target="_blank"
				rel="noreferrer"
				className="mt-3 inline-block text-xs underline underline-offset-4"
			>
				{t("setup.install")} — usemagpie.ai
			</a>
		</section>
	);
}
