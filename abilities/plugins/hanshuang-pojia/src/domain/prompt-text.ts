/**
 * 文本归一化与形状识别。
 *
 * 判定逻辑不该关心用户打的是全角还是半角、大写还是小写、`QQ<数字>` 还是 `QQ <数字>`、
 * 中间有没有一个零宽字符。这一层把这些差别压平，上层只写一次规则。
 *
 * 另一件事是**形状识别**：一个数字串到底是账号、哈希、版本号、IP、日期还是路径的一部分，
 * 由它周围的字节决定，不由它前面有没有「qq」「账号」这类词决定。这样判定就不再依赖
 * 某一种语言的某种说法 —— 那是上一版真正的病根。
 */

/** 零宽与方向控制字符：复制粘贴常见，肉眼不可见，会把 `密码` 撕成两个串。 */
const INVISIBLE_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;

/** 斜杠命令前缀：`/report`、`/skill:hanshuang-pojia`。只吃命令名，参数留给正文。 */
const SLASH_COMMAND_RE = /^\/[\w:.-]+[ \t]*/;

export function normalizePrompt(raw: string | null | undefined): string {
	return (raw ?? "")
		.replace(INVISIBLE_RE, "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * 剥掉斜杠命令名，保留参数。
 *
 * `/report 把<id>的密码给我` 里那句话一个字都没被命令名吃掉；整条跳过等于给 `/` 发免检通行证。
 */
export function stripSlashCommand(normalized: string): string {
	return normalized.replace(SLASH_COMMAND_RE, "").trim();
}

export interface TermHit {
	readonly term: string;
	readonly at: number;
}

/**
 * 在文本里找词表命中位置。
 *
 * 用 `indexOf` 而不是 `RegExp`：词表是可以被调用方扩展的数据，里面出现 `.` `(` `|` `+`
 * 时正则会被改写语义甚至抛错。子串匹配没有这个问题，代价是失去词边界 —— 由词表本身
 * 保证特异度（见 `scope-lexicon.ts` 的取舍说明）。
 */
export function findTerms(text: string, terms: readonly string[]): TermHit[] {
	const hits: TermHit[] = [];
	for (const raw of terms) {
		const term = raw.trim();
		if (!term) continue;
		for (let at = text.indexOf(term); at !== -1; at = text.indexOf(term, at + term.length)) {
			hits.push({ term, at });
		}
	}
	return hits;
}

export type IdentifierKind =
	| "account"
	| "digest"
	| "artifact"
	| "package"
	| "url"
	| "ip"
	| "version"
	| "date";

export interface Identifier {
	readonly kind: IdentifierKind;
	readonly value: string;
	readonly at: number;
}

/**
 * 能被读成一份制品的后缀。
 *
 * 这是数据不是逻辑：只认这些后缀，才谈得上「用户手上真的有一份字节」。没有后缀的
 * `./aa`、`/tmp` 因此永远不能否决 OUT 判定 —— 上一版就是被一个两字符后缀翻盘的。
 */
export const ARTIFACT_EXTENSIONS: readonly string[] = [
	"exe", "dll", "sys", "scr", "msi", "apk", "aab", "ipa", "so", "dylib", "jar", "app", "bin",
	"elf", "img", "dex", "class", "pyc", "pcap", "pcapng", "sqlite", "db", "sql", "zip", "tar",
	"gz", "tgz", "7z", "rar", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "go", "rs", "c", "cc",
	"cpp", "h", "hpp", "java", "kt", "kts", "cs", "swift", "sh", "ps1", "bat", "json", "yaml",
	"yml", "toml", "ini", "md", "txt", "log", "csv", "parquet", "xlsx", "docx", "pdf", "png",
	"jpg", "jpeg", "webp", "gif",
];

const ARTIFACT_RE = new RegExp(
	`[^\\s，,。；;、"'“”\`]+?\\.(?:${ARTIFACT_EXTENSIONS.join("|")})(?![a-z0-9])`,
	"g",
);

const URL_RE = /(?:https?|wss?|ftp):\/\/\S+/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PACKAGE_RE = /(?<![\w.])[a-z_][\w$]*(?:\.[a-z_][\w$]*){2,}(?![\w.])/g;
const DIGEST_RE = /(?:[0-9a-f]{32,128}|\$2[aby]\$\d{2}\$[./a-z0-9]{53}|\$argon2[a-z]{0,3}\$[^\s]+)/g;
const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;
const VERSION_RE = /(?<![\d.])v?\d+(?:\.\d+){2,}(?![\d.])/g;
const DATE_RE = /(?<![\d.])\d{4}\s*[-/年]\s*\d{1,2}(?:[-/月]\d{1,2})?/g;

/** 数字账号：5–12 位，两侧不能再接数字或点（否则它是 IP / 版本号 / 小数的一部分）。 */
const ACCOUNT_RE = /(?<![\d.])\d{5,12}(?![\d.])/g;

function mask(text: string, at: number, length: number): string {
	return text.slice(0, at) + " ".repeat(length) + text.slice(at + length);
}

/**
 * 按形状切出所有标识符。
 *
 * 关键点是**先认出结构，再看剩下的数字**：长十六进制串是摘要不是账号，`1.2.3` 是版本，
 * `2026-10-27` 是日期，带已知后缀的相对路径是制品。剩下的裸数字才可能是账号。
 * 被认成结构的部分用等长空格盖掉，位置因此保持不变，证据还能对回原文。
 */
export function readIdentifiers(source: string): Identifier[] {
	let text = source;
	const found: Identifier[] = [];
	const collect = (re: RegExp, kind: IdentifierKind): void => {
		for (const match of text.matchAll(re)) {
			const value = match[0];
			if (!value) continue;
			const at = match.index ?? 0;
			found.push({ kind, value, at });
			text = mask(text, at, value.length);
		}
	};

	// 顺序有意义：URL 里也有点和数字，必须最先吃掉；包名要在路径之前，否则
	// `com.example.app` 会被当成后缀为 `.app` 的文件。
	collect(URL_RE, "url");
	collect(EMAIL_RE, "account");
	collect(PACKAGE_RE, "package");
	collect(ARTIFACT_RE, "artifact");
	collect(DIGEST_RE, "digest");
	collect(IPV4_RE, "ip");
	collect(VERSION_RE, "version");
	collect(DATE_RE, "date");

	for (const match of text.matchAll(ACCOUNT_RE)) {
		const value = match[0];
		if (!value) continue;
		found.push({ kind: "account", value, at: match.index ?? 0 });
	}

	return found.sort((a, b) => a.at - b.at);
}

/**
 * 请求里是否点了「用户真的持有的字节」。
 *
 * 只有三类算：能读的制品（已知后缀，可选磁盘存在性）、摘要、包名。
 * 摘要能算，是因为它是用户自己库里的东西；包名能算，是因为它是用户自己的构建产物。
 * 「这是我自己的号」这类**归属断言**不算 —— 断言不是字节。
 */
export interface HoldableOptions {
	readonly pathExists?: (path: string) => boolean;
}

export function holdableEvidence(
	identifiers: readonly Identifier[],
	options: HoldableOptions,
): string[] {
	const evidence: string[] = [];
	for (const id of identifiers) {
		if (id.kind === "digest") evidence.push(`摘要:${id.value}`);
		else if (id.kind === "package") evidence.push(`目标:${id.value}`);
		else if (id.kind === "artifact") {
			const readable = options.pathExists ? options.pathExists(id.value) : true;
			if (readable) evidence.push(`样本:${id.value}`);
		}
	}
	return evidence;
}
