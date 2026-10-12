// 通过 Edge 的 CDP 通道量一量 /workbench 在 1440×1000 下的真实盒模型，确认没有溢出。
const PORT = process.env.CDP_PORT || "9333";

const expr = `(() => {
  const q = (s) => document.querySelector(s);
  const main = q('main');
  const grid = main && main.children[1];
  const card = grid && grid.firstElementChild;
  const panel = main && main.children[2];
  const rows = panel && panel.children[1];
  const rails = document.querySelectorAll('aside');
  const rail = rails[1];
  const m = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
  const out = {
    viewport: [window.innerWidth, window.innerHeight],
    painted: window.__astraviaDesignPainted ?? null,
    htmlScrollHeight: document.documentElement.scrollHeight,
    bodyChildren: document.body.children.length,
    main: m(main),
    mainScroll: main ? main.scrollHeight : null,
    grid: m(grid),
    card: m(card),
    panel: m(panel),
    rowBox: m(rows),
    rowScroll: rows ? rows.scrollHeight : null,
    rowCount: rows ? rows.children.length : null,
    rail: m(rail),
    railScroll: rail ? rail.scrollHeight : null,
    railClient: rail ? rail.clientHeight : null,
    input: !!q('input'),
    svgCount: document.querySelectorAll('svg').length,
    pathCount: document.querySelectorAll('path').length,
    iconClasses: Array.from(document.querySelectorAll('[class*="icon-["]')).length,
    errText: (document.body.innerText.match(/error|Error|失败 to|Cannot/) || []).slice(0, 3),
    lastRunRow: rows ? (rows.lastElementChild ? rows.lastElementChild.innerText.replace(/\\s+/g, ' ') : null) : null,
  };
  return JSON.stringify(out);
})()`;

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes("/workbench"));
if (!page) {
  console.log("没有找到 /workbench 页面：", list.map((t) => `${t.type} ${t.url}`).join(" | "));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

await new Promise((r) => ws.addEventListener("open", r));
const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
console.log("MEASURE:", res.result?.result?.value ?? JSON.stringify(res).slice(0, 400));
ws.close();
