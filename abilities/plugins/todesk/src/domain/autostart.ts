/**
 * Did the autostart setting actually take effect?
 *
 * `-autostart on` only asks; the client's own `-status` line is the evidence. They
 * disagree in the case ToDesk documents (faq 104): on Windows, Fast Startup keeps the
 * old startup state, so the flag reads back unchanged after a reboot.
 *
 * `null` means the read-back did not report the field at all — unknown, not failure.
 */
export interface AutostartVerdict {
	/** true = applied, false = asked for but not in effect, null = could not tell. */
	applied: boolean | null;
	/** Only present when it did not apply. */
	hint?: string;
	/** The official remedy, quoted rather than paraphrased (faq 104). */
	remedy?: string;
}

export function judgeAutostart(requested: boolean, observed: boolean | null): AutostartVerdict {
	if (observed === null) return { applied: null, hint: "the client did not report the startup flag, so this is unverified" };
	if (observed === requested) return { applied: true };

	return {
		applied: false,
		hint: requested
			? "the client still reports start-with-Windows off after the request"
			: "the client still reports start-with-Windows on after the request",
		remedy:
			requested === false
				? "控制面板 → 硬件和声音 → 电源选项 → 选择电源按钮的功能 → 更改当前不可用的设置 → 取消勾选「启用快速启动」，重启后复查"
				: "控制面板 → 电源选项 → 同上关闭「快速启动」，重启后复查；仍不生效则检查任务计划程序里是否有被禁用的 ToDesk 项",
	};
}
