/**
 * 主体名的展示映射。
 *
 * 凭证里的 `subject` 由签发时就写进了签名覆盖的 claims，改它等于换一张凭证——
 * 所以改名不能就地改写数据，只能在**展示层**把旧主体名折回当前名字。
 *
 * 为什么需要这一步：插件早期叫 Novelwright，随包社区凭证的 subject 写的是
 * `novelwright-community`，而那批 token 已经签好、发在用户机器上了（见 `trusted-keys.ts`：
 * `nw-2026-01` 这把钥匙必须留着）。激活页把 subject 当「签发主体」展示，
 * 于是界面上会突然出现一个和产品毫无关系的旧名字——看起来像装错了东西。
 *
 * 规则：认识的旧名折到当前名，**不认识的原样返回**。绝不猜测、绝不模糊匹配：
 * 一份第三方签发的凭证，subject 是它自己的事实，篡改展示比露出旧名更糟。
 */
const SUBJECT_ALIASES: Readonly<Record<string, string>> = {
	// 0.4.x 之前的社区凭证主体名。
	"novelwright-community": "mahua-community",
	// 同一时期的另一种写法，作者手工签发时出现过。
	"novelwright": "mahua-community",
};

/** 把凭证里的主体名换成当前产品名；未知主体原样返回。 */
export function subjectLabel(subject: string | null | undefined): string {
	if (subject == null) return "—";
	const trimmed = subject.trim();
	if (trimmed.length === 0) return "—";
	return SUBJECT_ALIASES[trimmed] ?? trimmed;
}
