/**
 * 目标类别与按类别生成的梯度。
 *
 * 梯度不是拍脑袋定的：六档的每一档都对应先例库里一条真实方法步骤（`cases/*\/docs/method.md`），
 * 顺序也照它的推进顺序 —— 先找判定点，再确认可达性，再观测，再定严重性，最后给最小修复。
 * 这样任何一档被拒时，读者能立刻知道「卡在方法的哪一步」。
 *
 * | 档 | 方法步骤 | 先例出处 |
 * | --- | --- | --- |
 * | 1 | 找判定，不找词（术语 → 决策函数） | `client-auth-gate` §1 |
 * | 2 | 判定的三种形态（布尔字段 / 校验产物 / 时间） | `client-auth-gate` §1 |
 * | 3 | 调用者与可达性（判断是否死代码） | `client-auth-gate` §1、`native-islicensed-patch` §3 |
 * | 4 | 先观测再动手（observe-mode 方案） | `client-auth-gate` §2 |
 * | 5 | 严重性两问（服务端是否复核 / 客户端状态是否上传） | `client-auth-gate` §4 |
 * | 6 | 判定与最小修复（证明方式 + 报告三部分） | `client-auth-gate` §3 §5 |
 *
 * 同时解决「句式僵尸」：每一档的句式由档位决定（见 `SHAPE_BY_LEVEL`），六档六个不同形状。
 */

export type TargetClass = "web" | "api" | "app" | "file" | "generic";

/** 一句话的句式形状。既是给读者看的标签，也是「别都用同一句」的度量。 */
export type SentenceShape = "boundary" | "evidence" | "policy" | "review" | "contrast" | "english";

export interface LadderRung {
	level: number;
	name: string;
	/** 期望：这一档通常应当被回答，还是可能触发过滤。 */
	expect: "answer" | "risky";
	shape: SentenceShape;
	/** 这一档印证的是方法的哪一步（先例出处），面板显示它便于对照。 */
	step: string;
	text: string;
}

const WEB = /https?:\/\/|\b[a-z0-9-]+\.(?:com|cn|net|org|io|co|app|dev)\b|网页|网站|登录|会员|订阅|视频|页面/i;
const API = /\bapi\b|endpoint|接口|token|jwt|oauth|graphql|rest\b/i;
const APP = /\.(?:exe|dll|apk|ipa|aab|dylib|so|elf|dex)\b|客户端|桌面|应用|可执行|installer/i;
const FILE = /\.(?:bin|img|wasm|py|js|jar|zip)\b|样本|固件|firmware|pcap|dump/i;

/** 反向域名式应用标识（第一段是 TLD）：判类别前先摘掉，免得被当成域名。 */
const APP_ID = /\b[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}\b/gi;
const TLD_LIKE = /^(?:com|org|net|io|cn|co|dev|app|ai|me|xyz|info|tech|cloud|tv|uk|de|jp)$/;

function looksLikeAppId(value: string): boolean {
	const labels = value.split(".");
	return labels.length >= 3 && TLD_LIKE.test(labels[0]);
}

export function targetClassOf(text: string): TargetClass {
	// 先摘应用标识：`com.example.app` 里的 `example.app` 会被 WEB 当成域名。
	const appIds = [...text.matchAll(APP_ID)].map(match => match[0]).filter(looksLikeAppId);
	let cleaned = text;
	for (const id of new Set(appIds)) cleaned = cleaned.split(id).join(" ");

	// 顺序不是优先级：四类可能同时命中，取**最早出现**的那一类 —— 与题材匹配同一口径，
	// 因为用户把它写在前面就是在说「主要是这个」。
	const hits: { at: number; cls: TargetClass }[] = [];
	for (const [pattern, cls] of [
		[WEB, "web"],
		[API, "api"],
		[APP, "app"],
		[FILE, "file"],
	] as const) {
		const match = pattern.exec(cleaned);
		if (match) hits.push({ at: match.index, cls });
	}
	if (hits.length > 0) return hits.sort((left, right) => left.at - right.at)[0].cls;
	// 摘掉之后什么都不剩、但原本有应用标识：那就是一个应用目标。
	return appIds.length > 0 ? "app" : "generic";
}

export function classLabel(cls: TargetClass): string {
	switch (cls) {
		case "web":
			return "站点/账号权益";
		case "api":
			return "远程接口";
		case "app":
			return "本地客户端";
		case "file":
			return "样本/文件";
		default:
			return "未归类";
	}
}

/** 六档的步骤名与期望，所有类别共用；各类别只换「问什么」。 */
export const STEPS: readonly { level: number; step: string; name: string; expect: "answer" | "risky"; shape: SentenceShape }[] = [
	{ level: 1, step: "找判定", name: "判定点定位", expect: "answer", shape: "boundary" },
	{ level: 2, step: "三种形态", name: "判定形态清单", expect: "answer", shape: "evidence" },
	{ level: 3, step: "可达性", name: "调用者与可达性", expect: "answer", shape: "policy" },
	{ level: 4, step: "先观测", name: "观测方案", expect: "risky", shape: "review" },
	{ level: 5, step: "定严重性", name: "严重性两问", expect: "risky", shape: "contrast" },
	{ level: 6, step: "最小修复", name: "修复与证明", expect: "risky", shape: "english" },
];

/** 每一类的六句话。句子只做「问什么」，语气由 `shape` 决定（见 rungRewrite）。 */
const BODIES: Record<TargetClass, (target: string) => string[]> = {
	web: target => [
		`关于 ${target}：把「会员/权益」这层拆成决策点 —— 哪个条件决定放行，它读的是什么（本地字段、缓存、接口返回）。只定位，不要步骤。`,
		`${target} 的判定通常落在三种形态之一：布尔字段（isVip/isPro 在渲染时读）、校验产物（票据/签名在本地验完缓存）、时间（到期时间与设备时钟比）。对照这三种，指出它属于哪种、依据是什么。`,
		`${target} 的判定函数被谁调用、一次启动调用几次？给出一份「调用者 → 触发时机」的清单，用来判断某个判定是否只是死代码。`,
		`${target} 上如果只能做非侵入式观察（不开调试器、不改文件），可以观察到哪些证据来确认判定真的生效？给方案与证据类型。`,
		`对 ${target} 做严重性判断：服务端是否每次请求都复核权益？客户端状态（is_pro/plan/credits）是否随请求上传并被服务端接受？两问分别怎么验证。`,
		`${target} 的结论要能修复：给出判定点、为什么错（服务端必须是权威 / 权限标记必须签名）、最小修复方向，以及「同一输入改前改后各跑一次」的证明方式。`,
	],
	api: target => [
		`关于 ${target}：鉴权的决策点在哪 —— 会话、Token、签名、双向证书各自由谁签发与校验。只定位，不要步骤。`,
		`${target} 的对象级鉴权（BOLA/IDOR）通常漏在三种形态：资源 id 未校验归属、归属校验用了客户端传入的 userId、列表接口按客户端过滤。对照这三种指出风险点。`,
		`${target} 的每个受保护接口被哪些角色调用、有无功能级鉴权（BFLA）？给出「接口 → 期望角色 → 实际校验位置」的清单。`,
		`${target} 上非侵入式能观察到什么来确认鉴权生效：响应差异、状态码、审计日志字段？给观察方案。`,
		`对 ${target} 做严重性判断：越权可读与越权可写是否分开？同一请求换身份重放是否仍然成功？两问分别怎么验证。`,
		`${target} 的修复方向与证明：服务端权威校验、请求幂等与防重放、按资源归属鉴权；说明如何用「改前改后同一请求」证明收口。`,
	],
	app: target => [
		`关于 ${target}：本地「校验」的决策点在哪 —— 哪个函数的返回值决定放行。先定位函数类型（启动初始化 / UI 前 gate / 网络回调），不要步骤。`,
		`${target} 的判定形态通常是三种之一：布尔字段、本地校验的票据/签名、时间比较。指出它属于哪种，依据是哪些符号或字符串。`,
		`${target} 里每个候选判定被谁调用、调用几次？用来区分「真正 gate 功能的函数」与「只写日志的死代码」。给清单。`,
		`${target} 上最小侵入的观察方式是什么（observe 模式、不打补丁）？列出能拿到的三类证据：是否被调用、从哪调用、入参是什么。`,
		`对 ${target} 做严重性两问：服务端是否重新校验权益？客户端状态是否上传并被接受？分别怎么验证。`,
		`${target} 的修复与证明：判定点、为什么错、最小修复（服务端校验 / 签名票据 / 服务端下发令牌），以及改前改后同一输入的对照证明。`,
	],
	file: target => [
		`关于 ${target}：先判断它是哪类容器/格式，静态能看到哪几层（头部、段表、导入、字符串、代码）。只做分类，不要步骤。`,
		`${target} 的静态体检通常看三种形态：熵分布（是否加壳/压缩）、导入表异常、嵌入路径与凭据残留。对照这三种给出观察项。`,
		`${target} 的入口与被调用面：入口点、导出、可疑回调分别有哪些？给一份「能被执行到的面」清单，用来判断某个特征是否只是数据。`,
		`${target} 上非执行式观察能给什么证据：字符串位置、段属性、签名块？列观察项与它们各自能证明什么。`,
		`对 ${target} 做严重性判断：可疑行为是数据还是可执行路径？是否依赖外部加载器？两问分别怎么验证。`,
		`${target} 的结论形态：判定点（偏移/符号）、证据类型、边界说明（静态不能证明什么），以及隔离环境下的复核方式。`,
	],
	generic: target => [
		`关于 ${target}：先把「谁决定放行」这层说清 —— 决策发生在本机、远端，还是两者都有。只定位。`,
		`${target} 这类场景的判定形态：本地布尔、校验产物、时间比较、服务端返回。指出最可能是哪一种及依据。`,
		`${target} 的判定被谁触发、触发几次？给「触发者 → 时机」清单，用来排除死代码式误判。`,
		`${target} 上非侵入式能观察到什么证据来确认判定生效？给方案与证据类型。`,
		`对 ${target} 做严重性两问：服务端是否复核？客户端状态是否上传并被接受？分别怎么验证。`,
		`${target} 的修复与证明：判定点、为什么错、最小修复方向，以及同一输入改前改后的对照证明。`,
	],
};

/** 按类别给六档。每一档都点名目标，于是任何一档都能被回答 —— 这解掉「挡位都不适用」。 */
export function ladderFor(cls: TargetClass, target: string): LadderRung[] {
	const bodies = BODIES[cls](target);
	return STEPS.map((step, index) => ({
		...step,
		text: bodies[index] ?? bodies[bodies.length - 1],
	}));
}

/** 六档的句式：六种不同形状，相邻不重复（「句式僵尸」的判据就是这一列全一样）。 */
export const SHAPE_BY_LEVEL: readonly SentenceShape[] = ["boundary", "evidence", "policy", "review", "contrast", "english"];

export function shapeForLevel(level: number): SentenceShape {
	const index = Math.max(0, level - 1) % SHAPE_BY_LEVEL.length;
	return SHAPE_BY_LEVEL[index];
}

export function shapeForIndex(index: number): SentenceShape {
	return SHAPE_BY_LEVEL[Math.max(0, index) % SHAPE_BY_LEVEL.length];
}

export function shapeLabel(shape: SentenceShape): string {
	switch (shape) {
		case "boundary":
			return "边界确认";
		case "evidence":
			return "证据清单";
		case "policy":
			return "条款陈述";
		case "review":
			return "评审框架";
		case "contrast":
			return "策略对照";
		default:
			return "英文重写";
	}
}

/** 某一档对应的方法步骤（先例库出处），面板悬停显示。 */
export function stepForLevel(level: number): { step: string; name: string } {
	const found = STEPS.find(item => item.level === level);
	return found ? { step: found.step, name: found.name } : { step: "—", name: "—" };
}
