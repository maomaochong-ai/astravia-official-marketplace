import { type ReactNode, useState } from "react";
import { normalizeDeviceId } from "../../../domain/todesk-cli";
import type { Note, Session } from "../hooks/use-todesk-console";

/**
 * The outbound half, laid out the way the user reads it: **code and password on one
 * row**, then connect. Both are required — ToDesk will not open a session to somebody
 * else's machine without its temporary password, so the password is a field, not an
 * "optional" toggle.
 *
 * The password input is the only masked thing on this panel (`type="password"`); the
 * device code is a public identifier and is shown plainly.
 */
export function ConnectCard({
	busy,
	note,
	session,
	localDeviceId,
	screenHint,
	onConnect,
	onDisconnect,
	onRefreshLocal,
	onOpenClient,
	t,
}: {
	busy: boolean;
	note: Note;
	session: Session | null;
	localDeviceId: string | null;
	screenHint: string;
	onConnect: (deviceId: string, password: string) => Promise<boolean>;
	onDisconnect: () => Promise<boolean>;
	onRefreshLocal: () => void;
	onOpenClient: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
	const [deviceId, setDeviceId] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	const normalized = normalizeDeviceId(deviceId);
	const digits = deviceId.replace(/\s+/g, "").length;
	const ready = Boolean(normalized) && password.trim().length > 0;

	const hint = !normalized
		? deviceId.length === 0
			? t("connect.hint")
			: t("connect.digits", { count: digits })
		: password.trim().length === 0
			? t("connect.needPassword")
			: t("connect.ready", { id: normalized });

	return (
		<section className="td-panel px-4 py-3.5">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="td-title">{t("connect.title")}</h2>
				<button type="button" className="td-btn" data-tone="ghost" onClick={onOpenClient}>
					{t("connect.openClient")}
				</button>
			</div>

			<form
				className="mt-2 flex flex-nowrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (!ready) return;
					void onConnect(deviceId, password);
				}}
			>
				<input
					className="td-field min-w-0 flex-1"
					inputMode="numeric"
					autoComplete="off"
					aria-label={t("connect.deviceId")}
					placeholder={t("connect.deviceId")}
					value={deviceId}
					onChange={(event) => setDeviceId(event.target.value)}
				/>
				<div className="relative min-w-0 flex-1">
					<input
						className="td-field w-full pr-8"
						type={showPassword ? "text" : "password"}
						autoComplete="off"
						aria-label={t("connect.password")}
						placeholder={t("connect.password")}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<button
						type="button"
						className="td-field-eye"
						aria-pressed={showPassword}
						aria-label={showPassword ? t("connect.password.hide") : t("connect.password.show")}
						onClick={() => setShowPassword((value) => !value)}
					>
						{showPassword ? t("connect.password.hide") : t("connect.password.show")}
					</button>
				</div>
				<button type="submit" className="td-btn shrink-0" data-tone="primary" disabled={busy || !ready}>
					{busy ? t("connect.busy") : t("connect.action")}
				</button>
			</form>

			<div className="mt-1.5 flex flex-wrap items-center gap-2">
				<p className="td-meta">{hint}</p>
				<span className="td-meta">·</span>
				<span className="td-meta">
					{t("connect.own")} <span className="td-mono">{localDeviceId ?? "—"}</span>
				</span>
				<button type="button" className="td-btn" data-tone="ghost" onClick={onRefreshLocal}>
					{t("connect.ownRefresh")}
				</button>
			</div>
			<p className="td-meta mt-1">{screenHint}</p>

			{session ? (
				<div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--td-rule)] pt-2.5">
					<div className="min-w-0">
						<div className="text-[12px]">
							{session.state === "started"
								? t("session.started", { id: session.target })
								: t("session.ended", { id: session.target })}
						</div>
						<p className="td-meta">{session.state === "started" ? t("session.hint") : t("session.ended.hint")}</p>
					</div>
					{session.state === "started" ? (
						<button
							type="button"
							className="td-btn shrink-0"
							data-tone="outline"
							disabled={busy}
							onClick={() => void onDisconnect()}
						>
							{busy ? t("session.disconnecting") : t("session.disconnect")}
						</button>
					) : null}
				</div>
			) : null}

			{note ? (
				<p
					className="td-meta mt-2 whitespace-pre-wrap"
					style={{
						color:
							note.kind === "error" ? "var(--td-bad)" : note.kind === "ok" ? "var(--td-ok)" : "var(--td-dim)",
					}}
				>
					{note.text}
				</p>
			) : null}
		</section>
	);
}
