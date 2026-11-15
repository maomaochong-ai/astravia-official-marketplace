/**
 * 从对话文本里认出"要测什么"（纯函数）。
 *
 * 为什么需要它：面板的「目标」以前只来自 `strix_sandbox_start` 的 `targets` 参数。
 * 于是两种常见情形下一片空白——用户在普通对话里写了域名、或者 agent 用了本机模式
 * （根本不建沙箱）。用户把这看成"插件没解析出目标"。
 *
 * 这里只做**候选**：从人写的句子里认出主机、URL、IP、CIDR。它不是范围的权威——
 * 声明范围是 agent 的动作（`strix_scope`），候选只是让面板在声明之前就能显示
 * "这轮大概在打什么"，并在声明之后自动退化成同一份清单的一部分。
 *
 * 认得准比认得多重要：一个错误的目标会让人以为测的是别的东西。所以：
 *  - 只认带点的主机名（`a.test`）、IPv4、CIDR 与 URL；不认裸机器名（`web-01`）；
 *  - 排除本机、文件扩展名、包名/版本（`node.js` / `1.2.3`）、常见 TLD 列表以外的后缀；
 *  - 同一主机去重，保留第一次出现的顺序（人的阅读顺序就是他的关注顺序）。
 */

export type TargetKind = "url" | "domain" | "ip" | "cidr";

export interface DerivedTarget {
	/** 归一化后的值：URL 保留 scheme+host，其余只留主机的部分。 */
	value: string;
	kind: TargetKind;
	/** 第一次出现的位置，用来保持顺序与调试。 */
	at: number;
}

const TLD = new Set([
	"com", "net", "org", "io", "dev", "app", "ai", "co", "me", "info", "biz", "xyz", "site", "online",
	"test", "local", "internal", "lan", "example", "invalid", "localhost",
	"cn", "hk", "tw", "jp", "kr", "sg", "us", "uk", "de", "fr", "nl", "ru", "br", "in", "au", "ca",
	"gov", "edu", "mil", "int", "cloud", "tech", "shop", "store", "wiki", "page", "link", "top",
]);

/** 明显不是主机的后缀：源码、配置、文档、媒体、包管理器产物。 */
const FILE_EXT = /\.(?:[cm]?[jt]sx?|py|go|rs|rb|php|java|kt|swift|cs|c|h|cc|cpp|json|ya?ml|toml|ini|conf|cfg|env|md|txt|rst|log|csv|tsv|sql|sh|bash|zsh|ps1|bat|lock|map|min|png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|tgz|bz2|xz|7z|tar|exe|dll|so|dylib|wasm|pem|crt|cer|key|p12|jks|deb|rpm|apk|ipa|dmg|iso)$/i;

const LOCALHOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$/;

function kindOf(value: string): TargetKind {
	if (/^https?:\/\//i.test(value)) return "url";
	if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(value)) return "cidr";
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return "ip";
	return "domain";
}

/** `https://A.test./x?y=1` → `https://a.test`；`a.test:8443` → `a.test`。 */
function normalizeUrl(raw: string): string | undefined {
	try {
		const url = new URL(raw);
		const host = url.hostname.replace(/\.$/, "").toLowerCase();
		if (!host || LOCALHOST.test(host)) return undefined;
		if (FILE_EXT.test(host)) return undefined;
		return `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
	} catch {
		return undefined;
	}
}

function normalizeHost(raw: string): string | undefined {
	const value = raw.trim().replace(/^[("'`<\[]+|[)"'`>\],.;:]+$/g, "").toLowerCase();
	if (!value) return undefined;
	if (FILE_EXT.test(value)) return undefined;
	// 端口不参与判定：先剥掉再比本机名单，否则 `127.0.0.1:8080` 会被当成外部主机。
	if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(value)) return LOCALHOST.test(value) ? undefined : value;
	if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(value)) {
		const bare = value.replace(/:\d+$/, "");
		return LOCALHOST.test(bare) ? undefined : bare;
	}
	if (LOCALHOST.test(value.replace(/:\d+$/, ""))) return undefined;
	const hostMatch = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?::\d+)?$/.exec(value);
	if (!hostMatch) return undefined;
	const host = hostMatch[1]!;
	const tld = host.slice(host.lastIndexOf(".") + 1);
	if (!TLD.has(tld)) return undefined;
	// 版本号与"两个字母的缩写"不是主机：`1.2.3`、`v1.2`。
	if (/^\d+(?:\.\d+)+$/.test(host)) return undefined;
	return host;
}

/**
 * 从一段文字里取出候选目标，按出现顺序去重。
 *
 * 输入可以是用户的一句话、agent 的一段答复，或一条命令；三类来源用同一把尺子量，
 * 因为读者看到的都是"这段字里提到了哪些主机"。
 */
export function extractTargets(text: string): DerivedTarget[] {
	if (!text || text.length < 3) return [];
	const found: DerivedTarget[] = [];
	const seen = new Set<string>();
	const push = (value: string | undefined): void => {
		if (!value) return;
		const key = value.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		found.push({ value, kind: kindOf(value), at: found.length });
	};

	// URL 先取：它带着 scheme，剥完仍然是一个'确定要说'的地址。
	// 取过的片段用空格抹掉再扫主机，否则同一个 URL 会以 url + domain 两种形状各出现一次。
	let rest = text;
	for (const match of text.matchAll(/https?:\/\/[^\s"'`<>()[\]]+/gi)) {
		push(normalizeUrl(match[0]));
		rest = rest.replace(match[0], " ".repeat(match[0].length));
	}
	// IPv4 / CIDR（同样抹掉再扫，否则 `192.168.0.0/24` 会再以 `192.168.0.0` 出现一次）
	for (const match of rest.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?(?::\d+)?\b/g)) {
		push(normalizeHost(match[0]));
		rest = rest.replace(match[0], " ".repeat(match[0].length));
	}
	// 主机名（带点、TLD 在白名单里）
	for (const match of rest.matchAll(/\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d+)?\b/gi)) {
		push(normalizeHost(match[0]));
	}
	return found;
}

/** 面板上的计数用：候选去掉已被同值包含的那些。 */
export function newTargets(derived: readonly DerivedTarget[], known: readonly string[]): DerivedTarget[] {
	const declared = new Set(known.map((value) => value.toLowerCase()));
	return derived.filter((target) => {
		const bare = target.value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
		return !declared.has(target.value.toLowerCase()) && !declared.has(bare);
	});
}
