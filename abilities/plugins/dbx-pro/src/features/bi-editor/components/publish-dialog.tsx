/**
 * publish-dialog.tsx — 发布与分享对话框（设计稿 share.tsx 对齐）。
 *
 * 三种分享方式：链接（永久/定时）、嵌入（iframe 代码）、导出（PNG/PDF）。
 * 状态分两屏：填写元数据 → 发布中 → 发布完成。
 */

import { type JSX, useState } from "react";
import { Icon } from "./ui/icon";
import { Chip } from "./ui/chip";
import { IconButton } from "./ui/icon-button";

type ShareMode = "link" | "embed" | "export";

export function PublishDialog({ pageName, onClose }: { pageName: string; onClose: () => void }): JSX.Element {
	const [mode, setMode] = useState<ShareMode>("link");
	const [linkType, setLinkType] = useState<"permanent" | "timed">("permanent");
	const [timedHours, setTimedHours] = useState(24);
	const [state, setState] = useState<"edit" | "publishing" | "done">("edit");
	const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

	function handlePublish(): void {
		setState("publishing");
		setTimeout(() => {
			setPublishedUrl(`https://bi.example.com/share/${Buffer.from(pageName).toString("base64").slice(0, 12)}`);
			setState("done");
		}, 900);
	}

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="w-[560px] overflow-hidden rounded-card border border-border-strong bg-surface-raised shadow-2xl">
				{/* 标题栏 */}
				<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
					<Icon name="icon-[lucide--share-2]" className="size-3.5 shrink-0 text-muted" />
					<span className="text-[13px] font-semibold text-surface-foreground">发布与分享</span>
					<Chip tone="accent">{pageName}</Chip>
					<IconButton size="xs" icon="icon-[lucide--x]" title="关闭" onClick={onClose} className="ml-auto" />
				</div>

				{/* 模式切换 */}
				<div className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
					{(["link", "embed", "export"] as ShareMode[]).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => { setMode(m); setState("edit"); }}
							className={`flex h-7 items-center gap-1.5 rounded-control px-3 text-[11px] whitespace-nowrap ${
								mode === m ? "border border-border bg-surface text-surface-foreground" : "border border-transparent text-muted hover:text-surface-foreground"
							}`}
						>
							<Icon name={
								m === "link" ? "icon-[lucide--link]" :
								m === "embed" ? "icon-[lucide--code]" : "icon-[lucide--download]"
							} className="size-3" />
							{m === "link" ? "分享链接" : m === "embed" ? "嵌入代码" : "导出文件"}
						</button>
					))}
				</div>

				{/* 主内容 */}
				<div className="max-h-[360px] overflow-y-auto px-4 py-4">
					{mode === "link" ? (
						state === "done" && publishedUrl ? (
							<div className="flex flex-col gap-3">
								<span className="flex h-7 items-center gap-2 text-[12px] text-surface-foreground">
									<Chip tone="primary">已发布</Chip>
									链接已生成，可以直接分享给他人
								</span>
								<div className="flex h-9 items-center gap-2 rounded-control border border-border bg-background px-3">
									<Icon name="icon-[lucide--link]" className="size-3.5 shrink-0 text-muted" />
									<span className="truncate font-mono text-[11px] text-surface-foreground">{publishedUrl}</span>
									<button type="button"
										className="ml-auto flex h-6 shrink-0 items-center gap-1 rounded-control border border-border bg-surface px-2 text-[10px] text-muted hover:text-surface-foreground">
										<Icon name="icon-[lucide--copy]" className="size-3" />复制
									</button>
								</div>
								<div className="flex gap-2">
									<button type="button" onClick={onClose}
										className="flex h-8 items-center rounded-control border border-border bg-surface px-3 text-[11px] text-surface-foreground">
										完成
									</button>
									<button type="button"
										className="flex h-8 items-center gap-1 rounded-control border border-border bg-surface px-3 text-[11px] text-muted">
										<Icon name="icon-[lucide--trash-2]" className="size-3" />撤回
									</button>
								</div>
							</div>
						) : state === "publishing" ? (
							<div className="flex h-32 flex-col items-center justify-center gap-2">
								<div className="size-6 animate-spin rounded-full border-2 border-border border-t-accent" />
								<span className="text-[11px] text-muted">正在发布…</span>
							</div>
						) : (
							<div className="flex flex-col gap-3">
								<span className="text-[11px] text-muted">选择链接类型</span>
								<div className="flex gap-2">
									<button type="button" onClick={() => setLinkType("permanent")}
										className={`flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-control border ${
											linkType === "permanent" ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong"
										}`}>
										<Icon name="icon-[lucide--infinity]" className="size-5 text-muted" />
										<span className="text-[11px] font-medium text-surface-foreground">永久链接</span>
										<span className="text-[9px] text-faint">只要数据不删就有效</span>
									</button>
									<button type="button" onClick={() => setLinkType("timed")}
										className={`flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-control border ${
											linkType === "timed" ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong"
										}`}>
										<Icon name="icon-[lucide--timer]" className="size-5 text-muted" />
										<span className="text-[11px] font-medium text-surface-foreground">限时链接</span>
										<span className="text-[9px] text-faint">到期自动失效</span>
									</button>
								</div>
								{linkType === "timed" ? (
									<div className="flex items-center gap-2">
										<span className="text-[11px] text-muted">有效时长</span>
										<input type="range" min={1} max={168} value={timedHours}
											onChange={(e) => setTimedHours(parseInt(e.target.value, 10))}
											className="h-1 flex-1 accent-accent" />
										<span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-surface-foreground">
											{timedHours < 24 ? `${timedHours}h` : `${Math.round(timedHours / 24)}d`}
										</span>
									</div>
								) : null}
								<div className="flex gap-2 pt-2">
									<button type="button" onClick={handlePublish}
										className="flex h-8 items-center gap-1 rounded-control bg-accent px-3 text-[11px] font-medium text-accent-foreground hover:opacity-90">
										<Icon name="icon-[lucide--rocket]" className="size-3" />发布并生成链接
									</button>
									<button type="button" onClick={onClose}
										className="flex h-8 items-center rounded-control border border-border bg-surface px-3 text-[11px] text-muted">
										取消
									</button>
								</div>
							</div>
						)
					) : mode === "embed" ? (
						<div className="flex flex-col gap-3">
							<div className="flex h-6 items-center gap-1.5 text-[11px] text-muted">
								<Icon name="icon-[lucide--code]" className="size-3 shrink-0" />
								嵌入到已有网页中 — iframe 代码
							</div>
							<pre className="overflow-x-auto rounded-control border border-border bg-background px-3 py-2 font-mono text-[10px] leading-relaxed text-surface-foreground">
{`<iframe
  src="https://bi.example.com/embed/${Buffer.from(pageName).toString("base64").slice(0, 12)}"
  width="100%" height="600"
  frameborder="0"
></iframe>`}
							</pre>
							<button type="button" onClick={onClose}
								className="mt-auto flex h-8 items-center rounded-control border border-border bg-surface px-3 text-[11px] text-surface-foreground">
								完成
							</button>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<span className="text-[11px] text-muted">导出为静态文件，便于归档和汇报</span>
							<div className="grid grid-cols-2 gap-2">
								{[
									{ icon: "icon-[lucide--image]", label: "PNG 截图", note: "适合放入 PPT" },
									{ icon: "icon-[lucide--file-text]", label: "PDF 报告", note: "适合归档" },
									{ icon: "icon-[lucide--table]", label: "CSV 数据", note: "带完整查询结果" },
									{ icon: "icon-[lucide--file-json]", label: "JSON 配置", note: "方便迁移" },
								].map((f) => (
									<button key={f.label} type="button"
										className="flex h-16 flex-col items-start justify-center gap-1 rounded-control border border-border bg-surface px-3 text-left hover:border-border-strong">
										<Icon name={f.icon} className="size-4 text-muted" />
										<span className="text-[11px] font-medium text-surface-foreground">{f.label}</span>
										<span className="text-[9px] text-faint">{f.note}</span>
									</button>
								))}
							</div>
							<button type="button" onClick={onClose}
								className="mt-auto flex h-8 items-center rounded-control border border-border bg-surface px-3 text-[11px] text-surface-foreground">
								完成
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
