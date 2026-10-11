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
				className="dbx-dialog"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				style={{ maxHeight: "70vh" }}
			>
				<div className="dbx-dialog__head">
					<span className="icon-[lucide--info] h-4 w-4 text-muted-foreground" />
					<h3 className="dbx-dialog__title">{detail.column}</h3>
					<span className="shrink-0 rounded bg-neutral-muted px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">
						{parsed.kind}
					</span>
					<button
						type="button"
						onClick={onClose}
						title="关闭"
						aria-label="关闭"
						className="dbx-iconbtn"
					>
						<span className="icon-[lucide--x] h-3.5 w-3.5" />
					</button>
				</div>
				<div className="dbx-dialog__body bg-surface-sunken">
					{parsed.kind === "null" ? (
						<p className="text-center font-mono text-[12px] italic text-muted-foreground/70">NULL</p>
					) : (
						<pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-foreground/80">
							{parsed.text}
						</pre>
					)}
				</div>
				<div className="dbx-dialog__foot">
					<button type="button" className="dbx-btn ghost" onClick={copy}>
						<span className={`h-3.5 w-3.5 ${copied ? "icon-[lucide--check] text-success" : "icon-[lucide--copy]"}`} />
						{copied ? "已复制" : "复制"}
					</button>
					<div className="ml-auto" />
					<button type="button" className="dbx-btn primary" onClick={onClose}>
						关闭
					</button>
				</div>
			</div>
		</div>
	);
}
