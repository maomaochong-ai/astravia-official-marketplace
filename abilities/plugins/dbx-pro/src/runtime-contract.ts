/**
 * 宿主运行时契约 — 只暴露 PluginCommandApi 句柄。
 *
 * activate() 时由宿主把 command 注入进来；所有 domain/feature 层
 * 通过 getCommand() 获取，不直接持有宿主引用。这是插件与宿主耦合的最小点。
 */

import type { PluginCommandApi } from "@astravia-org/plugin-sdk";

let _command: PluginCommandApi | null = null;

export function setCommand(c: PluginCommandApi) { _command = c; }
export function getCommand(): PluginCommandApi {
	if (!_command) throw new Error("dbx-pro plugin not activated");
	return _command;
}
