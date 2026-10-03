/**
 * 单元格详情弹窗 — 查看完整值（长文本 / JSON / 二进制）。
 *
 * - 对象/数组 → 美化 JSON
 * - 字符串：可解析为 JSON 时提供美化视图，否则按纯文本展示
 * - 一键复制；Esc / 点击遮罩关闭
 */

import { useEffect, useState, type JSX } from "react";

export interface CellDetail {
	column: string;
	value: unknown;
}

function classify(value: unknown): { kind: "null" | "json" | "text"; text: string } {
	if (value === null || value === undefined) return { kind: "null", text: "" };
	if (typeof value === "object") {
		return { kind: "json", text: JSON.stringify(value, null, 2) };
	}
	const raw = String(value);
	if (typeof value === "string") {
		const trimmed = raw.trim();
		if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
			try {
				return { kind: "json", text: JSON.stringify(JSON.parse(trimmed), null, 2) };
			} catch {
				// 不是合法 JSON，按文本处理
			}
		}
	}
	return { kind: "text", text: raw };
}

export function CellDetailDialog({ detail, onClose }: { detail: CellDetail; onClose: () => void }): JSX.Element {
	const parsed = classify(detail.value);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	function copy(): void {
		void navigator.clipboard.writeText(parsed.text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		}).catch(() => {});
	}

	return (
		<div className="dbx-modal-backdrop" onClick={onClose}>
			<div
				className="flex max-h-[70vh] w-[560px] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl shadow-black/50"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
					<span className="icon-[lucide--info] h-4 w-4 text-blue-400" />
					<h3 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-100">{detail.column}</h3>
					<span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-zinc-400">
						{parsed.kind}
					</span>
					<button
						type="button"
						onClick={copy}
						title="复制"
						className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					>
						<span className={`h-3.5 w-3.5 ${copied ? "icon-[lucide--check] text-emerald-400" : "icon-[lucide--copy]"}`} />
					</button>
					<button
						type="button"
						onClick={onClose}
						title="关闭"
						className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					>
						<span className="icon-[lucide--x] h-3.5 w-3.5" />
					</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto bg-[#0b0d13] p-3">
					{parsed.kind === "null" ? (
						<p className="text-center font-mono text-[12px] italic text-zinc-600">NULL</p>
					) : (
						<pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-zinc-300">
							{parsed.text}
						</pre>
					)}
				</div>
			</div>
		</div>
	);
}
