/**
 * One entry of the scan trace, rendered the way upstream's TUI renders it.
 *
 * Upstream projects SDK events into `{type: "chat" | "tool", agent_id, data}`
 * (strix/interface/tui/live_view.py:_append_event) and then dispatches on that
 * shape. The bridge forwards those records unchanged, so this file mirrors
 * render.Chat / render.Tool rather than inventing its own vocabulary:
 *
 *   chat/user      ▍ You: <text>            (blue bar, bold label)
 *   chat/assistant plain markdown
 *   tool           → Using tool <name> / args / status glyph
 */

export interface TuiUiEvent {
	id?: string;
	type?: string;
	agent_id?: string;
	timestamp?: string;
	version?: number;
	data?: Record<string, unknown>;
}

export interface TraceBlockProps {
	event: TuiUiEvent;
}

function text(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

/** Upstream `statusIcon`: ● In progress... / ✓ Done / ✗ Failed / ✗ Error. */
function statusGlyph(status: string): { glyph: string; tone: string } {
	switch (status) {
		case "running":
			return { glyph: "● In progress...", tone: "astra-strix-amber" };
		case "completed":
			return { glyph: "✓ Done", tone: "astra-strix-green" };
		case "failed":
			return { glyph: "✗ Failed", tone: "astra-strix-red" };
		case "error":
			return { glyph: "✗ Error", tone: "astra-strix-red" };
		default:
			return { glyph: "○ Unknown", tone: "astra-strix-dim" };
	}
}

function ChatBlock({ data }: { data: Record<string, unknown> }): React.ReactElement {
	const role = text(data.role);
	const content = text(data.content);
	if (role === "user") {
		return (
			<div className="astra-strix-chat-user">
				{content.split("\n").map((line, index) => (
					<p key={index} className="astra-strix-chat-line">
						<span className="astra-strix-bar">▍</span>
						{index === 0 ? <strong> You:</strong> : null} {line}
					</p>
				))}
			</div>
		);
	}
	return <p className="astra-strix-chat-assistant">{content}</p>;
}

function ToolBlock({ data }: { data: Record<string, unknown> }): React.ReactElement {
	const name = text(data.tool_name) || "tool";
	const args = (data.args ?? {}) as Record<string, unknown>;
	const keys = Object.keys(args).sort();
	const status = statusGlyph(text(data.status));
	return (
		<div className="astra-strix-tool">
			<p className="astra-strix-tool-head">
				<span className="astra-strix-dim">→ Using tool </span>
				<strong className="astra-strix-blue">{name}</strong>
			</p>
			{keys.map((key) => (
				<p key={key} className="astra-strix-tool-arg">
					<span className="astra-strix-dim">{key}: </span>
					{text(args[key])}
				</p>
			))}
			<p className={status.tone}>{status.glyph}</p>
		</div>
	);
}

export function TraceBlock({ event }: TraceBlockProps): React.ReactElement | null {
	const data = (event.data ?? {}) as Record<string, unknown>;
	if (event.type === "chat") return <ChatBlock data={data} />;
	if (event.type === "tool") return <ToolBlock data={data} />;
	return null;
}
