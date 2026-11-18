/**
 * The remedy strings, in one place.
 *
 * Both the posture findings (agent-facing `fix`) and the readiness item (`fix`) point at the
 * same four switches and the same two commands. They used to be written out in both modules,
 * which is how a path ends up corrected in one place and stale in the other — it already
 * happened once with the ToDesk menu paths (高级设置 → 安全设置).
 *
 * Rules: a command when one exists; otherwise the exact client path, in Chinese because the
 * client's UI is Chinese; never a sentence.
 */

export const ACCESS_FIX = {
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
} as const;
