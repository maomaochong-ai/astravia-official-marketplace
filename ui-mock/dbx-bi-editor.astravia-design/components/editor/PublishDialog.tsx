import Btn from "../Btn";
import Chip from "../Chip";
import Icon from "../Icon";
import IconButton from "../IconButton";

const PAGES = ["概览", "渠道明细", "城市分布"];

/**
 * 发布与分享 —— 一次动作里的三个承诺：产物落到工作树、给一条不会过期的链接、
 * 给一条会过期的链接。三件事写在一张卡上，因为它们在用户心里就是一件事：
 * 「这块看板现在归谁看、看多久」。
 */
export default function PublishDialog() {
	return (
		<div className="absolute inset-0 z-40 flex items-center justify-center bg-scrim">
			<div className="w-[560px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_24px_64px_var(--color-scrim)]">
				<header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
					<Icon name="icon-[lucide--upload]" className="size-4 shrink-0 text-accent" />
					<span className="text-[13px] font-semibold text-surface-foreground">发布到 BI 工作树</span>
					<Chip tone="accent">渠道经营看板 v4</Chip>
					<span className="ml-auto shrink-0">
						<IconButton size="sm" icon="icon-[lucide--x]" title="关闭" />
					</span>
				</header>

				<div className="flex flex-col gap-3 px-4 py-3">
					<div>
						<span className="text-[11px] text-muted">这次改了什么</span>
						<div className="mt-1 flex h-8 items-center rounded-control border border-border bg-surface px-2.5 text-[12px] text-surface-foreground">
							折线图改为按周聚合，补去年同期虚线
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						{[
							{ on: true, title: "存进工作树（草稿）", desc: "随时继续改，产物页面保持上一版" },
							{ on: false, title: "存进工作树并生成产物页面", desc: "概览 · 渠道明细 · 城市分布 一起替换" },
						].map((o) => (
							<label key={o.title} className="flex items-center gap-2.5">
								<span
									className={`grid size-3.5 shrink-0 place-items-center rounded-full border ${
										o.on ? "border-accent" : "border-border-strong"
									}`}
								>
									{o.on ? <span className="size-1.5 rounded-full bg-accent" /> : null}
								</span>
								<span className="text-[12px] text-surface-foreground">{o.title}</span>
								<span className="ml-auto shrink-0 text-[11px] text-faint">{o.desc}</span>
							</label>
						))}
					</div>

					<div className="flex items-center gap-1.5">
						<span className="text-[11px] text-muted">产物页面</span>
						{PAGES.map((p) => (
							<Chip key={p}>{p}</Chip>
						))}
						<span className="flex size-[18px] items-center justify-center rounded-chip bg-neutral-muted text-muted">
							<Icon name="icon-[lucide--plus]" className="size-2.5" />
						</span>
					</div>

					<span className="h-px w-full shrink-0 bg-border" />

					<div>
						<div className="flex h-6 items-center gap-2">
							<Icon name="icon-[lucide--link-2]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">永久链接</span>
							<span className="rounded-chip bg-neutral-muted px-1.5 text-[10px] text-muted">只读</span>
							<span className="ml-auto text-[10px] text-faint">随工作树更新，不会过期</span>
						</div>
						<div className="mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-accent">
								bi.local/d/chan-ops-6f2a
							</span>
							<Btn size="xs" variant="ghost" icon="icon-[lucide--copy]">
								复制
							</Btn>
						</div>
					</div>

					<div>
						<div className="flex h-6 items-center gap-2">
							<Icon name="icon-[lucide--calendar-clock]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">限期分享</span>
							<div className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-muted">
								<span className="flex h-6 items-center rounded-control border border-border bg-surface px-2">
									7 天
								</span>
								<span className="flex h-6 items-center gap-1.5 rounded-control border border-border bg-surface px-2">
									<Icon name="icon-[lucide--lock]" className="size-3 text-faint" />
									访问密码已开启
								</span>
								<span className="flex h-6 items-center rounded-control border border-border bg-surface px-2">
									只读
								</span>
							</div>
						</div>
						<div className="mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground">
								bi.local/s/9k3p-7d
							</span>
							<Btn size="xs" variant="ghost">
								重新生成
							</Btn>
							<Btn size="xs" icon="icon-[lucide--copy]">
								复制
							</Btn>
						</div>
					</div>
				</div>

				<footer className="flex h-12 shrink-0 items-center gap-2 border-t border-border bg-background px-4">
					<span className="flex h-6 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[10px] text-warning">
						<span className="size-1.5 shrink-0 rounded-full bg-warning" />
						1 个节点未运行
					</span>
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<Btn variant="ghost" size="sm">
							取消
						</Btn>
						<Btn variant="primary" size="sm" icon="icon-[lucide--upload]">
							发布并复制链接
						</Btn>
					</div>
				</footer>
			</div>
		</div>
	);
}
