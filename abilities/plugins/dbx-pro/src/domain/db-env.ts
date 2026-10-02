/**
 * dbx 引擎数据目录环境变量。dbx CLI 和 sqlite3 CLI 都需要注入
 * DBX_DATA_DIR 来指向插件自己的存储——和引擎桌面应用隔离。
 */

export function getDbxDataDir(): string {
	const home = typeof process !== "undefined" && process.env
		? (process.env.HOME ?? process.env.USERPROFILE)
		: "";
	return home ? `${home}/.astravia/dbx-pro` : ".";
}

export const DBX_ENV: Record<string, string> = {
	DBX_DATA_DIR: getDbxDataDir(),
};
