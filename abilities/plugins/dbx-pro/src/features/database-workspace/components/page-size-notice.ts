/**
 * 每页行数越界提示 —— 设置面板与网格底栏下拉共用同一份措辞。
 *
 * 历史缺陷：输入超过上限会被静默改回上限值（Math.min），界面上没有任何反馈，
 * 用户以为自定义行数没生效。这里统一说明「实际会取哪个值」。
 */

import {
	MAX_RESULT_PAGE_SIZE,
	MIN_RESULT_PAGE_SIZE,
	type PageSizeInputResult,
} from "../../../domain/workbench-settings";

/** 返回越界说明；输入在合法区间内（或为空、为坏值时按原值处理）返回 null。 */
export function pageSizeNotice(parsed: PageSizeInputResult): string | null {
	if (parsed.exceededMax) {
		return `超出上限：单页最多 ${MAX_RESULT_PAGE_SIZE.toLocaleString()} 行，将按上限取值`;
	}
	if (parsed.belowMin) {
		return `低于下限：每页至少 ${MIN_RESULT_PAGE_SIZE.toLocaleString()} 行，将保留原值`;
	}
	return null;
}
