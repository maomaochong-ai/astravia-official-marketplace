import { type ReactNode, useState } from "react";

export function CopyButton({
	value,
	label,
	doneLabel,
	failedLabel,
}: {
	value: string;
	label: string;
	doneLabel: string;
	failedLabel: string;
}): ReactNode {
	const [result, setResult] = useState<"idle" | "done" | "failed">("idle");

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			setResult("done");
		} catch {
			setResult("failed");
		}
		window.setTimeout(() => setResult("idle"), 1600);
	}

	return (
		<button type="button" className="td-btn" data-tone="outline" onClick={() => void copy()} disabled={!value}>
			{result === "done" ? doneLabel : result === "failed" ? failedLabel : label}
		</button>
	);
}
