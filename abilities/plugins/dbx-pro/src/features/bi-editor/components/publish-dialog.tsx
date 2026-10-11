/**
 * publish-dialog.tsx — 发布到工作树对话框（设计稿 PublishDialog.tsx 对齐）。
 *
 * 语义：一次动作里的三个承诺 — 产物落到工作树、给一条永久链接、给一条限期分享。
 * 遮住整个编辑器（不是只遮画布）：发布是一次对外承诺，用户按下之前不该再摸画布。
 *
 * 三种状态：草稿 vs 生成产物页面 单选；永久链接 + 限期分享 展示；
 * footer 警告未运行节点数 + 发布按钮。
 */

import { type JSX, useState } from "react";
import { Icon } from "./ui/icon";
import { Chip } from "./ui/chip";
import { IconButton } from "./ui/icon-button";

/** 从字符串生成稳定 hash（用于永久链接/限期分享 URL，不能每次 render 都变）。 */
function stableHash(seed: string, len = 8): string {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let out = "";
	for (let i = 0; i < len; i++) { h ^= (h >>> 13); h = Math.imul(h, 1274126177); h ^= (h >>> 16); out += chars[h % chars.length]; }
	return out;
}

export function PublishDialog({
	pageName, version = "v1", pages = [], pendingRuns = 0,
	onClose, onPublish,
}: {
	pageName: string;
	version?: string;
	pages?: string[];
	pendingRuns?: number;
	onClose: () => void;
	onPublish?: () => void;
}): JSX.Element {
	/** true = 存草稿；false = 生成产物页面替换 */
	const [draftOnly, setDraftOnly] = useState(true);
	const [changeNote, setChangeNote] = useState("折线图改为按周聚合，补去年同期虚线");

	return (
		<div className="absolute inset-0 z-40 flex items-center justify-center bg-scrim">
			<div className="w-[560px] overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_24px_64px_var(--color-scrim)]">
				{/* header — 对齐设计稿：发布到 BI 工作树 */}
				<header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
					<Icon name="icon-[lucide--upload]" className="size-4 shrink-0 text-accent" />
					<span className="text-[13px] font-semibold text-surface-foreground">发布到 BI 工作树</span>
					<Chip tone="accent">{pageName} {version}</Chip>
					<IconButton size="sm" icon="icon-[lucide--x]" title="关闭" onClick={onClose} className="ml-auto" />
				</header>

				<div className="flex flex-col gap-3 px-4 py-3">
					{/* "这次改了什么" 变更说明输入 */}
					<div>
						<span className="text-[11px] text-muted">这次改了什么</span>
						<input type="text" value={changeNote} onChange={(e) => setChangeNote(e.target.value)}
							className="mt-1 h-8 w-full rounded-control border border-border bg-surface px-2.5 text-[12px] text-surface-foreground outline-none focus:border-accent" />
					</div>

					{/* 草稿 vs 生成产物页面 单选 */}
					<div className="flex flex-col gap-1.5">
						{[
							{ key: "draft", title: "存进工作树（草稿）", desc: "随时继续改，产物页面保持上一版" },
							{ key: "publish", title: "存进工作树并生成产物页面", desc: (pages.length ? pages.join(" · ") : "自动生成产物页面") + " 一起替换" },
						].map((o) => (
							<label key={o.key} className="flex cursor-pointer items-center gap-2.5">
								<span
									className={`grid size-3.5 shrink-0 place-items-center rounded-full border ${
										draftOnly === (o.key === "draft") ? "border-accent" : "border-border-strong"
									}`}
								>
									{draftOnly === (o.key === "draft") ? <span className="size-1.5 rounded-full bg-accent" /> : null}
								</span>
								<span className="text-[12px] text-surface-foreground">{o.title}</span>
								<span className="ml-auto shrink-0 text-[11px] text-faint">{o.desc}</span>
							</label>
						))}
					</div>

					{/* 产物页面 chips */}
					<div className="flex items-center gap-1.5">
						<span className="text-[11px] text-muted">产物页面</span>
						{(pages.length ? pages : ["概览", "明细", "详情"]).map((p) => (
							<Chip key={p}>{p}</Chip>
						))}
						<span className="grid size-[18px] shrink-0 place-items-center rounded-chip bg-neutral-muted text-muted">
							<Icon name="icon-[lucide--plus]" className="size-2.5" />
						</span>
					</div>

					<span className="h-px w-full shrink-0 bg-border" />

					{/* 永久链接 */}
					<div>
						<div className="flex h-6 items-center gap-2">
							<Icon name="icon-[lucide--link-2]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">永久链接</span>
							<Chip>只读</Chip>
							<span className="ml-auto text-[10px] text-faint">随工作树更新，不会过期</span>
						</div>
						<div className="mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-accent">
								bi.local/d/{pageName.toLowerCase().replace(/\s+/g, "-")}-{stableHash(pageName, 6)}
							</span>
							<button type="button"
								className="flex h-6 shrink-0 items-center gap-1 rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
								<Icon name="icon-[lucide--copy]" className="size-2.5" />复制
							</button>
						</div>
					</div>

					{/* 限期分享 */}
					<div>
						<div className="flex h-6 items-center gap-2">
							<Icon name="icon-[lucide--calendar-clock]" className="size-3.5 shrink-0 text-muted" />
							<span className="text-[11px] text-surface-foreground">限期分享</span>
							<div className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-muted">
								<span className="flex h-6 items-center rounded-control border border-border bg-surface px-2">7 天</span>
								<span className="flex h-6 items-center gap-1.5 rounded-control border border-border bg-surface px-2">
									<Icon name="icon-[lucide--lock]" className="size-3 text-faint" />访问密码
								</span>
								<span className="flex h-6 items-center rounded-control border border-border bg-surface px-2">只读</span>
							</div>
						</div>
						<div className="mt-1 flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground">
								bi.local/s/{stableHash(`${pageName}-share`, 10)}
							</span>
							<button type="button"
								className="flex h-6 shrink-0 items-center gap-1 rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
								重新生成
							</button>
							<button type="button"
								className="flex h-6 shrink-0 items-center gap-1 rounded-control border border-transparent px-2 text-[10px] text-muted hover:border-border hover:text-surface-foreground">
								<Icon name="icon-[lucide--copy]" className="size-2.5" />复制
							</button>
						</div>
					</div>
				</div>

				{/* footer — 设计稿：未运行节点警告 + 发布按钮 */}
				<footer className="flex h-12 shrink-0 items-center gap-2 border-t border-border bg-background px-4">
					{pendingRuns > 0 ? (
						<span className="flex h-6 items-center gap-1.5 rounded-chip bg-warning-soft px-2 text-[10px] text-warning">
							<span className="size-1.5 shrink-0 rounded-full bg-warning" />
							{pendingRuns} 个节点未运行
						</span>
					) : null}
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<button type="button" onClick={onClose}
							className="flex h-7 items-center rounded-control border border-transparent px-3 text-[11px] text-muted hover:border-border hover:text-surface-foreground">
							取消
						</button>
						<button type="button" onClick={() => { onPublish?.(); onClose(); }}
							className="flex h-7 items-center gap-1 rounded-control bg-accent px-3 text-[11px] font-medium text-accent-foreground hover:opacity-90">
							<Icon name="icon-[lucide--upload]" className="size-2.5" />发布并复制链接
						</button>
					</div>
				</footer>
			</div>
		</div>
	);
}
