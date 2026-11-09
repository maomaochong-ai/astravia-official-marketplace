import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	CLOSED_SNAPSHOT,
	isFatalLoadFailure,
	nextSeed,
	snapshotOf,
	type BoardmixSeed,
	type BoardmixSnapshot,
} from "../../../domain/boardmix-entry";
import { boardmixUrlOf, type BoardmixPhase } from "../../../domain/boardmix-destinations";
import { WEBVIEW_PARTITION } from "../../../plugin-ids";
import { missingPrimitives, primitivesOf } from "../../../domain/boardmix-primitive";
import type { BoardmixTabHandle } from "../services/tab-registry";
import { LoadFailureNotice } from "./load-failure-notice";
import { LoginRequiredNotice } from "./login-required-notice";

const NAVIGATE_TIMEOUT_MS = 12_000;
/** 首次没落地就再叫一次：访客进程刚起、DNS 抖一下都可能在首帧丢掉 did-navigate。 */
const NAVIGATE_ATTEMPTS = 2;
const NAVIGATE_RETRY_DELAY_MS = 400;
/** 断网恢复后自动重试一次；不叠加退避，只确保「网络回来了」不需要人再点一次。 */
const ONLINE_RETRY_DELAY_MS = 1_500;

type SurfaceStatus = "booting" | "ready" | "failed";

export interface BoardmixSurfaceProps {
	ladder: BoardmixSeed[];
	/** 主框架落在 boardmix 域上时回调，用于把真实地址写回存储。 */
	onLanded(url: string, landedAt: string): void;
	openExternal(url: string): void;
	translate(key: string): string;
}

interface WebviewLoadFailure extends Event {
	isMainFrame?: boolean;
	errorCode?: number;
	errorDescription?: string;
	validatedURL?: string;
}

interface WebviewNavigate extends Event {
	url?: string;
}

function currentUrlOf(element: HTMLWebViewElement | null): string {
	if (!element) return "";
	try {
		return element.getURL() || "";
	} catch {
		// 访客进程还没起来时 getURL 会抛，按「还不知道」处理。
		return "";
	}
}

/** 把 did-fail-load 的两个字段压成一行：人看得懂，工具能原样带回去。 */
function describeLoadFailure(failure: WebviewLoadFailure): string {
	const code = typeof failure.errorCode === "number" ? failure.errorCode : null;
	const text = failure.errorDescription?.trim() || "load failed";
	return code === null ? text : `${text} (${code})`;
}

/**
 * `<webview>` 的**唯一持有者**。所有会把访客进程带到别处的动作都从这里发出，
 * 因此 origin 闸门只需在调用前把住一次（entry-target.ts）。
 */
export const BoardmixSurface = forwardRef<BoardmixTabHandle, BoardmixSurfaceProps>(
	function BoardmixSurface(props, ref) {
		const { ladder, translate } = props;
		const webviewRef = useRef<HTMLWebViewElement | null>(null);
		const ladderRef = useRef(ladder);
		ladderRef.current = ladder;
		const callbacksRef = useRef({ onLanded: props.onLanded, openExternal: props.openExternal });
		callbacksRef.current = { onLanded: props.onLanded, openExternal: props.openExternal };

		const levelRef = useRef(1);
		const urlRef = useRef("");
		const landedAtRef = useRef<string | null>(null);
		const bootedRef = useRef(false);
		const pendingRef = useRef<((snapshot: BoardmixSnapshot) => void) | null>(null);
		// 三个能力不缓存：`<webview>` 的方法是 attach 之后才出现的，挂载时就检测会把
		// 「还没准备好」错记成「永远没有」。调用时再问一次，代价是一次属性查找。
		const timerRef = useRef<number | null>(null);

		const [status, setStatus] = useState<SurfaceStatus>("booting");
		const [phase, setPhase] = useState<BoardmixPhase>("unknown");
		// 机器离线时不是「插件坏了」，但也不能留白屏：状态行要写出是可恢复的。
		const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
		// 访客进程自己报的死因（did-fail-load 的 errorCode/描述），用来把「页面没加载出来」说清楚。
		const failureRef = useRef<string | null>(null);

		const snapshot = useCallback((): BoardmixSnapshot => {
			const element = webviewRef.current;
			const url = urlRef.current || currentUrlOf(element);
			const failure = failureRef.current ?? undefined;
			if (!url) {
				return { ...CLOSED_SNAPSHOT, open: element !== null, seedLevel: levelRef.current, failure };
			}
			return { ...snapshotOf(url, levelRef.current, landedAtRef.current), failure };
		}, []);

		const settlePending = useCallback(
			(value: BoardmixSnapshot) => {
				if (timerRef.current !== null) {
					window.clearTimeout(timerRef.current);
					timerRef.current = null;
				}
				const resolve = pendingRef.current;
				pendingRef.current = null;
				resolve?.(value);
			},
			[],
		);

		const loadUrl = useCallback((url: string) => {
			const element = webviewRef.current;
			if (!element) return;
			void Promise.resolve(element.loadURL(url)).catch(() => {
				// 真正的失败由 did-fail-load 接手；这里只吞掉 loadURL 自身的 reject。
			});
		}, []);

		const retry = useCallback(() => {
			const first = ladderRef.current[0];
			if (!first) return;
			levelRef.current = first.level;
			setStatus("booting");
			loadUrl(first.url);
		}, [loadUrl]);

		const openCurrentInBrowser = useCallback(async (): Promise<boolean> => {
			const url = snapshot().url;
			if (!url) return false;
			callbacksRef.current.openExternal(url);
			return true;
		}, [snapshot]);

		useImperativeHandle(
			ref,
			(): BoardmixTabHandle => ({
				navigate: async url => {
					if (!webviewRef.current) return CLOSED_SNAPSHOT;
					let landed = CLOSED_SNAPSHOT;
					for (let attempt = 1; attempt <= NAVIGATE_ATTEMPTS; attempt += 1) {
						failureRef.current = null;
						landed = await new Promise<BoardmixSnapshot>(resolve => {
							settlePending(snapshot());
							pendingRef.current = resolve;
							timerRef.current = window.setTimeout(() => settlePending(snapshot()), NAVIGATE_TIMEOUT_MS);
							levelRef.current = 1;
							setPhase("unknown");
							loadUrl(url);
						});
						// 落地了且访客没报错就是成功；否则只剩最后一发才把失败原因交回去。
						if (landed.open && !landed.failure) return landed;
						if (attempt === NAVIGATE_ATTEMPTS) return landed;
						await new Promise(done => window.setTimeout(done, NAVIGATE_RETRY_DELAY_MS));
					}
					return landed;
				},
				snapshot,
				openInBrowser: openCurrentInBrowser,
				async read(code) {
					const primitives = primitivesOf(webviewRef.current);
					if (!primitives) return null;
					try {
						return await primitives.run(code);
					} catch {
						// 访客页换了文档、或脚本自身报错：当「读到的是空的」处理。
						return null;
					}
				},
				async shot() {
					const primitives = primitivesOf(webviewRef.current);
					if (!primitives) return null;
					try {
						return await primitives.shot();
					} catch {
						return null;
					}
				},
				input(events) {
					const primitives = primitivesOf(webviewRef.current);
					return primitives ? primitives.input(events) : false;
				},
				gaps: () => missingPrimitives(webviewRef.current),
			}),
			[loadUrl, openCurrentInBrowser, settlePending, snapshot],
		);


		useEffect(() => {
			const element = webviewRef.current;
			if (!element) return;

			const onDomReady = () => {
				if (bootedRef.current) return;
				bootedRef.current = true;
				const first = ladderRef.current[0];
				if (first) {
					levelRef.current = first.level;
					loadUrl(first.url);
				} else {
					setStatus("failed");
				}
			};

			const onNavigate = (event: Event) => {
				const landedRaw = (event as WebviewNavigate).url || currentUrlOf(element);
				const landed = boardmixUrlOf(landedRaw);
				if (!landed) return; // 站外地址（人工点出去的外链）不落库，也不改状态。
				const landedAt = new Date().toISOString();
				urlRef.current = landed.toString();
				landedAtRef.current = landedAt;
				setStatus("ready");
				setPhase(snapshotOf(landed.toString(), levelRef.current, landedAt).phase);
				callbacksRef.current.onLanded(landed.toString(), landedAt);
				settlePending(snapshotOf(landed.toString(), levelRef.current, landedAt));
			};

			const onFailLoad = (event: Event) => {
				const failure = event as WebviewLoadFailure;
				if (!isFatalLoadFailure({ isMainFrame: failure.isMainFrame, errorCode: failure.errorCode })) {
					return;
				}
				// 记下死因：工具与面板都要能把「页面没加载出来」说成一个具体原因。
				failureRef.current = describeLoadFailure(failure);
				// 有导航在等结果时，不能悄悄换成下一级种子：那样报回来的地址
				// 不是调用方要的那一个，而工具会把它当成「到了」。失败就是失败。
				if (pendingRef.current) {
					setStatus("failed");
					settlePending(snapshot());
					return;
				}
				const fallback = nextSeed(ladderRef.current, levelRef.current);
				if (fallback) {
					levelRef.current = fallback.level;
					setStatus("booting");
					loadUrl(fallback.url);
					return;
				}
				setStatus("failed");
				settlePending(snapshot());
			};

			element.addEventListener("dom-ready", onDomReady);
			element.addEventListener("did-navigate", onNavigate);
			element.addEventListener("did-navigate-in-page", onNavigate);
			element.addEventListener("did-fail-load", onFailLoad);
			return () => {
				element.removeEventListener("dom-ready", onDomReady);
				element.removeEventListener("did-navigate", onNavigate);
				element.removeEventListener("did-navigate-in-page", onNavigate);
				element.removeEventListener("did-fail-load", onFailLoad);
			};
		}, [loadUrl, settlePending, snapshot]);

		useEffect(() => () => settlePending(CLOSED_SNAPSHOT), [settlePending]);

		// 网络是外部的：开 VPN / 断网 / 链路中途死掉，都不该让面板停在一个再也起不来的失败态上。
		// 离线只做两件事——把状态写给人看（不留白屏），并记下「是网络，不是页面」。
		useEffect(() => {
			const onOffline = () => setOffline(true);
			const onOnline = () => {
				setOffline(false);
				// 回来之后自己再走一次：失败态就从第一级重来，加载中也是。
				if (status !== "ready") window.setTimeout(retry, ONLINE_RETRY_DELAY_MS);
			};
			window.addEventListener("offline", onOffline);
			window.addEventListener("online", onOnline);
			return () => {
				window.removeEventListener("offline", onOffline);
				window.removeEventListener("online", onOnline);
			};
		}, [retry, status]);

		return (
			<div className="relative flex h-full w-full flex-col bg-background">
				{offline && status !== "ready" ? (
					<div className="absolute inset-x-0 top-0 z-10 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
						{translate("panel.offline")}
					</div>
				) : null}
				{status === "failed" ? (
					<LoadFailureNotice
						retryLabel={translate("panel.failure.retry")}
						externalLabel={translate("panel.failure.external")}
						title={translate("panel.failure.title")}
						body={translate("panel.failure.body")}
						onRetry={retry}
						onOpenExternal={() => void openCurrentInBrowser()}
					/>
				) : null}
				{phase === "login" && status !== "failed" ? (
					<LoginRequiredNotice
						title={translate("panel.login.title")}
						body={translate("panel.login.body")}
					/>
				) : null}
				<webview
					ref={element => {
						webviewRef.current = element;
					}}
					src="about:blank"
					partition={WEBVIEW_PARTITION}
					allowpopups
					className="h-full w-full flex-1 border-0"
				/>
			</div>
		);
	},
);
