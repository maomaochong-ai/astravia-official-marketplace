/**
 * The remedy strings, in one place, owned by the layers that show them.
 *
 * Both the posture findings (agent-facing `fix`) and the readiness items (`fix`) point at the
 * same four switches and the same two commands. They used to be written out in two domain
 * modules, which is how a path ends up corrected in one place and stale in the other — it
 * already happened once with the ToDesk menu paths (高级设置 → 安全设置).
 *
 * This is user-facing copy, so it does not live in `domain/`: those modules take an
 * `AccessFixes` value instead, and the tool layer and the panel each pass the wording they
 * want. Rules for the values: a command when one exists; otherwise the exact client path, in
 * Chinese because the client's UI is Chinese; never a sentence.
 */
export interface AccessFixes {
	clientStopped: string;
	noDeviceCode: string;
	postureUnknown: string;
	unattendedPassword: string;
	tempPassword: string;
	twoFactor: string;
	strangerDevices: string;
	autostart: string;
	staleSession: string;
	noSavedDevices: string;
}

export const ACCESS_FIX: AccessFixes = {
	clientStopped: "ToDesk.exe",
	noDeviceCode: "open the ToDesk client once and retry",
	postureUnknown: "open the ToDesk client once, then recheck",
	unattendedPassword: "ToDesk.exe -setpasswd <new password>, or 高级设置 → 安全设置 → 安全密码",
	tempPassword: "高级设置 → 安全设置 → 临时密码",
	twoFactor: "高级设置 → 安全设置 → 二次安全验证",
	strangerDevices: "高级设置 → 安全设置 → 连接限制（黑白名单 / 手动同意）",
	autostart: "ToDesk.exe -autostart on",
	staleSession: "ToDesk.exe -exit, or 个人中心 → 连接管理 → 断开该连接",
	noSavedDevices: "connect once with a code; ToDesk then saves the device",
};
