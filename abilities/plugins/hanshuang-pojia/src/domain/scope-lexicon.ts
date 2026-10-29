/**
 * 判定用的词表 —— 只有数据，没有逻辑。
 *
 * 这是目标形态路由里**唯一**需要随新说法扩充的地方：加一条说法 = 往数组里加一个字符串。
 * 不改判定代码、不写正则、不用担心用户贡献的词里带 `.` `(` `|` 把正则打烂 ——
 * 匹配走的是 `indexOf`（见 `prompt-text.ts`），不是 `RegExp`。
 *
 * 全部条目为小写半角：归一化（NFKC + 小写 + 折叠空白）在上层做完，中英混排进同一份表，
 * 于是「英文请求」不需要单独一条代码路径 —— 它只是词表里有英文词而已。
 */
export interface ScopeLexicon {
	/** 凭据名词：说出「要的是一份能登录的东西」。 */
	readonly credential: readonly string[];
	/** 账号名词：说明「指向一个具体账号」。具体是哪个由数字标识决定，不由这里决定。 */
	readonly account: readonly string[];
	/** 索取动词：把凭据往「我」这边搬。它出现时，排查/工程语境不再成立。 */
	readonly transfer: readonly string[];
	/** 接管动词：越过账号本身的控制权（把号变成自己的）。 */
	readonly takeover: readonly string[];
	/** 绕过动词：跳过一道判定（会员墙、激活、登录）—— 动作，且对象由别处决定。 */
	readonly circumvent: readonly string[];
	/** 排查标记：问的是「为什么进不去」，不是「把凭据给我」。 */
	readonly support: readonly string[];
	/** 工程语境：在写代码、改页面、做测试，不是在对一个号下手。 */
	readonly engineering: readonly string[];
	/** 指向他人。 */
	readonly otherPerson: readonly string[];
	/** 批量凭据库。 */
	readonly dump: readonly string[];
	/** 协议层诉求（决定转译落点）。 */
	readonly protocol: readonly string[];
	/** 权益 / 授权诉求（决定转译落点）。 */
	readonly entitlement: readonly string[];
}

/**
 * 默认词表。中文为主，英文同样列全 —— 它们走同一条判定路径。
 *
 * 取舍原则：只收**高特异度**的词。`号`、`id`、`token` 这类过于宽泛的没有进来：
 * `第12345号文件`、`id 字段怎么建索引` 会被一起误伤。可读性与召回之间宁可先保住精度，
 * 漏掉的说法由调用方通过 `RouteOptions.lexicon` 扩展，不需要改这个文件。
 */
export const DEFAULT_SCOPE_LEXICON: ScopeLexicon = {
	credential: [
		"密码",
		"口令",
		"密保",
		"凭据",
		"登录态",
		"验证码",
		"密码本",
		"password",
		"passwd",
		"pwd",
		"passphrase",
		"credential",
		"passcode",
	],
	account: [
		"账号",
		"帐号",
		"账户",
		"帐户",
		"用户名",
		"手机号",
		"邮箱",
		"微信号",
		"qq号",
		"qq",
		"微信",
		"wechat",
		"weixin",
		"微博",
		"抖音",
		"快手",
		"小红书",
		"telegram",
		"支付宝",
		"account",
		"username",
		"email",
		// 指代同样是「一个账号」：它指向上一句已经出现过的那个号。
		// 不这样做，单轮看到的就只剩一个索取动作，`那个号的密码给我` 会掉到 IN。
		"那个号",
		"这个号",
		"那个账号",
		"这个账号",
		"那个帐号",
		"这个帐号",
		"该账号",
		"该帐号",
		"此账号",
		"该号",
		"此号",
		"那个账户",
		"这个用户",
		"那个用户",
	],
	transfer: [
		"给我",
		"发我",
		"发给我",
		"拿来",
		"拿给我",
		"搞来",
		"弄来",
		"交出来",
		"传给我",
		"give me",
		"send me",
		"hand over",
		"share with me",
		// 「把凭据往我这边搬」不必是「给我」：请读一下、导出来、抓出来，都是同一个动作。
		"读一下",
		"读出来",
		"导出",
		"提取",
		"扒出来",
		"dump 出来",
	],
	takeover: [
		"破解",
		"盗",
		"盗取",
		"拿到",
		"拿掉",
		"获取",
		"搞到",
		"弄到",
		"查出",
		"套出",
		"猜出",
		"算出",
		"试出",
		"撞开",
		"登录进",
		"登上",
		"接管",
		"劫持",
		"爆破",
		"crack",
		"hack",
		"steal",
		"brute force",
	],
	circumvent: [
		"绕过",
		"旁路",
		"解锁",
		"跳过",
		"越过",
		"免密",
		"白嫆",
		"bypass",
		"circumvent",
		"unlock",
		"patch out",
	],
	support: [
		"怎么",
		"如何",
		"为什么",
		"为啥",
		"能不能",
		"能否",
		"是否",
		"查一下",
		"排查",
		"老是",
		"一直",
		"收不到",
		"进不去",
		"登不上",
		"登录不上",
		"失败",
		"how",
		"why",
		"cannot",
		"can't",
		"fails",
		"failed",
	],
	engineering: [
		"写一个",
		"写个",
		"实现",
		"重构",
		"单测",
		"接口",
		"组件",
		"页面",
		"正则",
		"表结构",
		"字段",
		"迁移",
		"部署",
		"文档",
		"autocomplete",
		// 代码语境的词：它们在的句子通常有一个工程对象（页面/接口/校验），
		// 因此可以安全地当作「不是在对着一个号下手」的信号。
		"校验",
		"逻辑",
		"代码",
		"源码",
		"函数",
		"方法",
		"脚本",
		"流程",
		"用例",
		"implement",
		"component",
		"endpoint",
		"regex",
		"migrate",
		"deploy",
	],
	otherPerson: [
		"别人",
		"他人",
		"对方",
		"陌生人",
		"某人",
		"那个人",
		"这个人",
		"此人",
		"前任",
		"他们",
		"她们",
		"someone else",
		"other people",
	],
	dump: ["撞库", "社工库", "拖库", "脱库", "洗库", "跑库", "credential stuffing", "combolist"],
	protocol: ["apk", "app", "客户端", "抓包", "协议", "sign", "签名", "接口", "api", "hook", "frida", "so"],
	entitlement: ["会员", "vip", "订阅", "权限", "绕过", "旁路", "解锁", "激活", "license", "licence", "内购", "iap", "premium"],
};

/** 调用方只想加几个词，不复制整张表。 */
export function mergeLexicon(
	base: ScopeLexicon,
	patch: Partial<ScopeLexicon> | undefined,
): ScopeLexicon {
	if (!patch) return base;
	const merged: Record<string, readonly string[]> = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		if (!value || value.length === 0) continue;
		merged[key] = [...(base[key as keyof ScopeLexicon] ?? []), ...value];
	}
	return merged as unknown as ScopeLexicon;
}
