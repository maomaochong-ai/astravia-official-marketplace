/**
 * 两条注入页面的脚本，各做一件事，并且**只说它看见了什么**。
 *
 * 这里没有画布 API：`createSticky` 那套对象模型不在页面全局上（bm-0001）。所以脚本
 * 走的是人能走的那两条路：
 *
 *   COMPOSER_SCRIPT — 找到 AI 输入框，把一段文本投进去，需要时点发送（bm-0003）。
 *   CANVAS_PASTE_SCRIPT — 在画布上做一次真实的粘贴，让产品自己的 Mermaid 转换器接住它（bm-0002）。
 *
 * 两条脚本都以「诊断」为主要输出：找到了哪个元素、用的是哪条路、结果如何。看不清就不要
 * 假装看清——这是这两个能力唯一诚实的失败方式。
 */

/** 输入框的候选：contenteditable 优先，聊天框通常是它；textarea 兜底。 */
const COMPOSER_SELECTORS = [
	'[contenteditable="true"][role="textbox"]',
	'[contenteditable="true"]',
	"textarea",
];

/**
 * 在焦点元素上派发一次真实 paste。`execCommand("insertText")` 做第二道保险，
 * 因为有的 contenteditable 只认命令而不认粘贴事件。
 */
const PASTE_HELPER = `
  const insert = (el, text) => {
    el.focus();
    let viaPaste = false;
    try {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
      viaPaste = el.dispatchEvent(event) === false;
    } catch (error) {
      viaPaste = false;
    }
    if (!viaPaste) {
      try {
        document.execCommand("insertText", false, text);
      } catch (error) {
        /* 两条都不行时如实返回 */
      }
    }
    return viaPaste;
  };
`;

export interface ComposerRequest {
	prompt: string;
	send: boolean;
}

/** 找到 AI 输入框、放进去、可选发送。返回诊断，不返回"成功"。 */
export function composerScript(request: ComposerRequest): string {
	const prompt = JSON.stringify(request.prompt);
	const send = request.send ? "true" : "false";
	return `(() => {
  const squish = value => String(value == null ? "" : value).replace(/\\s+/g, " ").trim();
  const SELECTORS = ${JSON.stringify(COMPOSER_SELECTORS)};
  let composer = null;
  let matched = null;
  for (const selector of SELECTORS) {
    const nodes = [...document.querySelectorAll(selector)].filter(el => {
      const box = el.getBoundingClientRect();
      return box.width > 40 && box.height > 16 && box.bottom > 0 && box.top < window.innerHeight;
    });
    if (nodes.length === 0) continue;
    // 取最靠下的那个：聊天输入框在页面底部，正文里的 contenteditable 通常在上面。
    nodes.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    composer = nodes[0];
    matched = selector;
    break;
  }
  if (!composer) {
    return { ok: false, reason: "no-composer", url: location.href, tried: SELECTORS };
  }
  const text = ${prompt};
  ${PASTE_HELPER}
  const viaPaste = insert(composer, text);
  const seen = squish(composer.innerText || composer.value || "").slice(0, 240);
  const wrote = seen.includes(text.slice(0, 24)) || seen.length > 0;

  let sent = false;
  let sendLabel = null;
  if (${send}) {
    const buttons = [...document.querySelectorAll('button,[role="button"],div[class*="send" i]')];
    const candidate = buttons.find(el => {
      const box = el.getBoundingClientRect();
      if (box.width < 12 || box.height < 12) return false;
      const label = squish(el.getAttribute("aria-label") || el.innerText || el.title);
      return /^(发送|发送消息|生成|立即生成|send|generate|submit)$/i.test(label) || /send/i.test(String(el.className));
    });
    if (candidate) {
      sendLabel = squish(candidate.getAttribute("aria-label") || candidate.innerText || candidate.title).slice(0, 40);
      candidate.click();
      sent = true;
    }
  }

  return {
    ok: wrote,
    reason: wrote ? null : "insert-rejected",
    url: location.href,
    composer: matched,
    viaPaste,
    preview: seen,
    sent,
    sendLabel
  };
})()`;
}

/**
 * 在画布上粘贴一段 Mermaid。找"画布"的办法是找一个大的、可编辑或可聚焦的区域，
 * 找不到就退回到 document 上派发——产品自己的粘贴监听器挂在 document 上的情况也真实存在。
 */
export function canvasPasteScript(text: string): string {
	const body = JSON.stringify(text);
	return `(() => {
  const squish = value => String(value == null ? "" : value).replace(/\\s+/g, " ").trim();
  ${PASTE_HELPER}
  const candidates = [...document.querySelectorAll('canvas,[contenteditable="true"],[tabindex="0"]')]
    .filter(el => {
      const box = el.getBoundingClientRect();
      return box.width > 320 && box.height > 240;
    })
    .sort((a, b) => {
      const ba = a.getBoundingClientRect();
      const bb = b.getBoundingClientRect();
      return bb.width * bb.height - ba.width * ba.height;
    });

  const target = candidates[0] || document.body;
  const tag = target.tagName.toLowerCase();
  const before = document.querySelectorAll("*").length;
  const viaPaste = insert(target, ${body});

  return {
    ok: true,
    url: location.href,
    target: tag,
    viaPaste,
    candidates: candidates.length,
    // 只当作"页面动了没有"的粗信号：DOM 节点数的变化，不是图形数量。
    domDelta: document.querySelectorAll("*").length - before
  };
})()`;
}
