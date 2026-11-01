import { getStudioRuntime } from "../../plugin-context.js";
import { STUDIO_VIEW_ID } from "../../studio-ids.js";

/**
 * 整页工作台的进出通道。
 *
 * 宿主的活动面板有一条硬底线：面板再宽也要给会话区留 `384px`（`ACTIVITY_PANEL_MIN_CHAT_AREA`
 * 在 atom 层统一夹紧，插件传多大都无效）。所以「全屏整个工作台」在活动面板里**做不到**，
 * 唯一能做到的位置是插件自己的工作区视图——它占宿主的主区，会话区整块让开。
 *
 * 那一跳由宿主的 `openWorkspaceView()` 完成，缺权限（`ui.slot.workspace-view`）或宿主太旧时
 * 它是 **warn + noop**，既不抛错也不报告失败。所以这里返回进入前的 hash，由调用方在一个
 * 短窗口后比对：没跳成就退回面板宽度通道，用户的点击永远不会落空。
 */

/** 宿主切路由不是同步的；等一小段再判定，比猜快慢可靠。 */
export const FULLSCREEN_SETTLE_MS = 400;

/**
 * 这一次是不是「从活动面板点进去的」。
 *
 * 只有这种情况才有得退：整页视图是宿主路由上的一格，插件没有返回对话区的导航能力
 * （`DOMAIN_NAVIGATION_CAPABILITIES` 里只有 `OPEN_HOSTED_ROUTE`），唯一可用的退路是浏览器
 * 历史——也就是用户自己刚才走进来的那一步。从侧栏「更多」直接进来时历史里没有这一步，
 * 那就一个返回键都不给（宿主侧栏就是出口），免得按下去把人送到别的页面。
 */
let enteredFromTab = false;

/** 从活动面板的工作台跳进整页工作台；返回进入前的 hash 作为判据。 */
export function enterStudioFullscreen(): string {
	const before = window.location.hash;
	enteredFromTab = true;
	try {
		getStudioRuntime().ctx.ui.openWorkspaceView(STUDIO_VIEW_ID);
	} catch {
		// 旧宿主没有这个方法：当作没跳成，调用方会退回面板宽度通道。
	}
	return before;
}

/** 这一跳到底有没有发生。 */
export function fullscreenLanded(before: string): boolean {
	return window.location.hash !== before;
}

/** 有没有一步可退。 */
export function canLeaveStudioFullscreen(): boolean {
	return enteredFromTab;
}

/**
 * 忘掉这一次进入。
 *
 * 两处要调：跳转没发生（缺权限 / 旧宿主）时，以及整页视图卸载时。不调的话，从侧栏
 * 直接进来的那个人会拿到一枚「退出全屏」，按下去被送到上一个页面——而那个页面跟
 * 这里毫无关系。
 */
export function forgetStudioFullscreen(): void {
	enteredFromTab = false;
}

/**
 * 退出整页工作台：回退到走进来的那一步（通常是某个会话里的活动面板）。
 * 退不了就什么都不做，让宿主自己的侧栏当出口。
 */
export function leaveStudioFullscreen(): void {
	if (!enteredFromTab) return;
	forgetStudioFullscreen();
	window.history.back();
}
