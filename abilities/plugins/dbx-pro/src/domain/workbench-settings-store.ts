/**
 * G2 工作台设置的持久化包装 —— 只做「宿主 storage ↔ 纯逻辑」的搬运。
 */
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage } from "../runtime-contract";
import { DEFAULT_SETTINGS, normalizeSettings, type WorkbenchSettings } from "./workbench-settings";

const STORE_PATH = "workbench-settings.json";
const STORE_SCHEMA_VERSION = 1;

export async function readSettings(): Promise<WorkbenchSettings> {
	const doc = await readJsonFile<Partial<WorkbenchSettings>>(getStorage(), STORE_PATH);
	return normalizeSettings(doc);
}

export async function writeSettings(settings: WorkbenchSettings): Promise<WorkbenchSettings> {
	const normalized = normalizeSettings(settings);
	await writeJsonFile(getStorage(), STORE_PATH, {
		schemaVersion: STORE_SCHEMA_VERSION,
		...normalized,
	});
	return normalized;
}

/** 恢复出厂设置（落盘并返回结果）。 */
export async function resetSettings(): Promise<WorkbenchSettings> {
	return writeSettings({ ...DEFAULT_SETTINGS });
}
