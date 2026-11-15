/**
 * 把清单里的 `%key%` 交给宿主的 `t` 解开（面板这一侧）。
 *
 * 为什么不在服务里解完：服务不知道宿主界面语言。清单里的名字与职责是**给人看的**，
 * 所以留着占位符一路传到面板，由持有 i18n 的这一层决定用哪种语言。
 *
 * 不是占位符就原样返回——服务已经解过的字符串会原样穿过去，不会二次解释。
 */
export function manifestLabel(t: (key: string) => string, value: string | undefined): string {
	const text = (value ?? "").trim();
	const wrapped = /^%(.+)%$/.exec(text);
	if (!wrapped) return text;
	const translated = t(wrapped[1]);
	return translated === wrapped[1] ? text : translated;
}
