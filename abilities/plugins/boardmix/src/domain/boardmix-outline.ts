/**
 * 读访客页的脚本：只做一件事——把「人能看见、能点到的那些东西」变成带坐标的清单。
 *
 * 这不是万能的：画布里的图形是像素，DOM 里没有它们。清单只覆盖真实的
 * HTML 控件（按钮、链接、标签页、输入框），也就是「要点哪里」这个问题。
 *
 * 坐标是访客页视口的 CSS 像素，中心和 `sendInputEvent` 用的是同一套坐标，
 * 所以模型读到的 (x, y) 可以直接拿去点。
 */
export const PAGE_OUTLINE_SCRIPT = `(() => {
  const clean = value => String(value == null ? "" : value).replace(/\\s+/g, " ").trim().slice(0, 80);
  const SELECTOR = 'a,button,[role="button"],[role="tab"],[role="menuitem"],input,textarea,select,[contenteditable="true"]';
  const items = [];
  const nodes = document.querySelectorAll(SELECTOR);
  for (const el of nodes) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    if (box.bottom < 0 || box.top > window.innerHeight) continue;
    if (box.right < 0 || box.left > window.innerWidth) continue;
    const label = clean(el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("placeholder") || el.title);
    if (!label) continue;
    const tag = el.tagName.toLowerCase();
    items.push({
      tag,
      label,
      role: clean(el.getAttribute("role")),
      x: Math.round(box.left + box.width / 2),
      y: Math.round(box.top + box.height / 2)
    });
    if (items.length >= 120) break;
  }
  const body = document.body;
  return {
    url: location.href,
    title: clean(document.title),
    readyState: document.readyState,
    login: /\\/(login|signin|sign-in)|passport\\./i.test(location.href),
    size: { width: window.innerWidth, height: window.innerHeight },
    scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
    items,
    text: clean(body ? body.innerText : "").slice(0, 1800)
  };
})()`;
