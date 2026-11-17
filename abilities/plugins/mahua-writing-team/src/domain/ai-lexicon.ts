/**
 * 机器腔词表与阈值的**形状**（不含任何词）。
 *
 * 为什么这样分：词表与数字是作者/编辑可以改的内容，代码是解释器。以前它们直接写在
 * `style-analysis.ts` 里，改一个词要发版，也没法解释"为什么 0.7"。现在：
 *
 *   `agent/lexicon/ai-tells.json`  →  `src/reference/lexicon.generated.ts`（构建期生成）
 *                                  →  `analyzeAiProfile(texts, lexicon)`
 *
 * 本文件只放类型与编译（把 JSON 里的 pattern 变成 RegExp），保持纯函数、不读文件、不含
 * 自然语言——领域层守卫会检查这一点。
 */

export interface LexiconEntry {
	/** 报给用户看的词形。 */
	phrase: string;
	/** 正则源码，不带斜杠与 flags。构建脚本已确保它能编译。 */
	pattern: string;
}

/** 画像使用的数字阈值。全部来自词表文件，代码里没有一个魔法数。 */
export interface AiLimits {
	/** 短于等于这个字数算短句。 */
	shortSentenceMax: number;
	/** 长于这个字数算长句。 */
	longSentenceMin: number;
	/** 句长落在均值 ±这个比例的区间内算"同一档"（诊断用，不直接决定 finding）。 */
	uniformBand: number;
	/** 段尾句短于本段均句长的这个比例，算"刹车"。 */
	brakeRatio: number;
	/**
	 * 句长离散度（标准差 / 均值）：低于这个数就是"每句差不多长"。
	 *
	 * 为什么用离散度而不用"落在均±25% 的占比"：后者会把正常的商业节奏（句句都是中句，
	 * 但长短仍有权重）判成机器腔，也会放过"段段三句一模一样"。离散度看的是起伏本身。
	 */
	sentenceDispersion: number;
	/** 段落句数的离散度：低于这个数就是"每段一样长"。 */
	paragraphDispersion: number;
	/** 段尾刹车占比达到这个数就报。 */
	shortEnding: number;
	/** 单章硬套句达到这个条数就报。 */
	hardTellTotal: number;
	/** 软词每千字密度达到这个数就报。 */
	softTellPerKilo: number;
	/** 解释尾巴句数达到这个数就报。 */
	explainTails: number;
	/** 少于这么多句不给节奏结论。 */
	sampleFloor: number;
	/** 少于这么多段不给段尾结论。 */
	shortEndingFloor: number;
}

export interface AiLexicon {
	limits: AiLimits;
	/** 出现即算的问题词（套句、情绪代称）。 */
	stock: readonly LexiconEntry[];
	/** 好文章也会用、只在密度过高时算问题的词。 */
	soft: readonly LexiconEntry[];
	/** 句首替读者总结的开头。 */
	explainHeads: readonly string[];
	/** 时间/天气起手的开头。 */
	timeHeads: readonly string[];
}

export interface CompiledEntry extends LexiconEntry {
	readonly re: RegExp;
}

export interface CompiledLexicon {
	limits: AiLimits;
	stock: readonly CompiledEntry[];
	soft: readonly CompiledEntry[];
	explainHeads: readonly string[];
	timeHeads: readonly string[];
}

/**
 * 编译一次，按调用方缓存。
 *
 * 一个无效的 `pattern` 不该让整章检查崩掉：构建期已经校验过，运行时再出错只能说明
 * 词表被手改坏了，此时跳过那一条比抛错更接近"没有这条规则"。
 */
export function compileLexicon(lexicon: AiLexicon): CompiledLexicon {
	const compile = (entries: readonly LexiconEntry[]): CompiledEntry[] => {
		const out: CompiledEntry[] = [];
		for (const entry of entries) {
			try {
				out.push({ ...entry, re: new RegExp(entry.pattern, "g") });
			} catch {
				/* 词表坏了：跳过这一条，其余照常 */
			}
		}
		return out;
	};
	return {
		limits: lexicon.limits,
		stock: compile(lexicon.stock),
		soft: compile(lexicon.soft),
		explainHeads: lexicon.explainHeads,
		timeHeads: lexicon.timeHeads,
	};
}
