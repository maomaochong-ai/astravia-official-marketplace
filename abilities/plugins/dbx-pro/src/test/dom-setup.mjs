/**
 * node:test 的 DOM 环境注册（--import 入口，在任何测试模块加载前执行）。
 *
 * happy-dom v15 不再提供 GlobalRegistrator，这里从 Window 实例手动挂载
 * window/document 等全局对象，并开启 React act 环境。
 */

import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });

function setGlobal(key, value) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

setGlobal("window", window);
setGlobal("document", window.document);
setGlobal("navigator", window.navigator);
setGlobal("getComputedStyle", window.getComputedStyle.bind(window));

// 把 Window 上的构造器 / 工具（Node、Element、MutationObserver、Event…）
// 补到全局，仅注册当前缺失的键。
for (const key of Object.getOwnPropertyNames(window)) {
  if (key === "window") continue;
  if (typeof globalThis[key] === "undefined") {
    const value = window[key];
    if (value !== undefined) setGlobal(key, value);
  }
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
