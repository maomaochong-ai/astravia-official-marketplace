/**
 * 先例的能力族。
 *
 * 为什么要有这一层：`preset` 是「开始时的沙箱类型」，19 个包全是 `offline-sample`，
 * 拿它当筛选维度会得到一个只有一档的筛选条；`platforms` 也全是 `any`。
 * 真正能区分的只有「这份先例打的是哪一类目标」，那是**数据**，写在 `case.json` 的
 * `category` 里，经 `sync-precedents` 进生成物，面板的分类筛选读同一份。
 *
 * 与 `scripts/lib/precedent-package.mjs` 的 `CASE_CATEGORIES` 必须逐字一致：
 * 那边是构建期校验（写在包上什么值才合法），这里是运行期与测试用的类型面。
 * `src/test/case/case-precedents.test.ts` 会对两边做一次字面比对，改一边不改另一边会红。
 */
export const CASE_CATEGORIES = ["android", "client-auth", "dotnet", "native-loader", "crypto-keygen", "web-js"] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export function isCaseCategory(value: string): value is CaseCategory {
	return (CASE_CATEGORIES as readonly string[]).includes(value);
}
