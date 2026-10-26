#!/usr/bin/env node
/**
 * 激活所有权门禁（ADR-0014）。
 *
 * 为什么需要它：宿主升级插件时先激活新版本、再拆旧版本，两段生命周期会交叠。
 * 只要激活期间创建的句柄被放进模块作用域，旧激活的 cleanup 就会释放新激活
 * 刚注册的视图 —— 侧栏入口消失，日志里却一切正常。这类缺陷肉眼过一遍 diff
 * 很难拦住，靠一次 `npm test` 可以。
 *
 * 只守源码形状，不模拟宿主生命周期：真正跑一遍交叠激活需要宿主，本机没有。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPath = path.join(root, "src", "index.tsx");
const source = fs.readFileSync(entryPath, "utf8");

const failures = [];
const checks = [];

// 模块作用域的可变句柄：允许 `let current` 这类「登记表」，禁止直接持有视图/控制器。
const moduleHandles = [...source.matchAll(/^let\s+(\w+)\s*:\s*([^=;]+)/gm)].map((match) => ({
  name: match[1],
  type: match[2].trim(),
}));

for (const handle of moduleHandles) {
  if (/Disposable|\bCanvasController\b/.test(handle.type)) {
    failures.push(`模块级 ${handle.name}: ${handle.type} —— 视图/控制器必须由单次激活持有`);
  }
}
checks.push(`模块级 let ${moduleHandles.length} 个，均未直接持有视图或控制器`);

// 激活必须返回 cleanup，且 cleanup 释放的是自己那份记录，不是模块变量。
const closure = source.match(/return \(\) => ([^;]+);/);
if (!closure) {
  failures.push("activate 没有返回 cleanup：宿主升级时旧注册不会被释放");
} else if (/activeView|activeController/.test(closure[1])) {
  failures.push(`cleanup 引用了模块级句柄（${closure[1].trim()}）：交叠激活时会释放别人的注册`);
} else {
  checks.push(`cleanup 释放闭包资源：${closure[1].trim()}`);
}

// 幂等守卫：宿主可能调用 cleanup 两次，视图 dispose 不耐受重复释放。
if (!/if \(\w+\.released\) return;/.test(source)) {
  failures.push("缺少 released 幂等守卫：重复 cleanup 会二次释放视图注册");
} else {
  checks.push("release() 有幂等守卫");
}

// 身份判定：已被替换的那一份不该清空别人的登记。
if (!/if \(current === \w+\) current = null;/.test(source)) {
  failures.push("缺少 `if (current === …) current = null`：旧激活会清掉新激活的登记");
} else {
  checks.push("释放后按身份清空登记");
}

for (const line of checks) console.log(`PASS  ${line}`);
if (failures.length > 0) {
  console.error(`\n[check-plugin-lifecycle] ${failures.length} 个问题：`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("[check-plugin-lifecycle] ok");
