/**
 * 结果导出 — 纯函数：单元格文本化、TSV / CSV 序列化。
 * 无 DOM / 无副作用，供 ResultGrid 的复制与导出复用，可独立单测。
 */

export function cellText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function toTsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.join("\t")];
	for (const row of rows) lines.push(cols.map((c) => cellText(row[c]).replaceAll("\t", " ")).join("\t"));
	return lines.join("\n");
}

function csvEscape(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.map(csvEscape).join(",")];
	for (const row of rows) lines.push(cols.map((c) => csvEscape(cellText(row[c]))).join(","));
	return `﻿${lines.join("\r\n")}`;
}
