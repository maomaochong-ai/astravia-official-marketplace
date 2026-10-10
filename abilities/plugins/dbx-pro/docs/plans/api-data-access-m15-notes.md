# M1.5 前置验证记录：`jdbc` 通用入口能不能用（2026-10-09）

## 一句话

`jdbc` 的运行时**在引擎里是有的**（`crates/dbx-plugin-runtime/src/plugins/{host,jdbc_sessions,manifest,runtime}.rs`），
但**经过 MCP 建不出可查询的连接**：JDBC 插件要的 URL 存在引擎的 `connection_string` 字段，
而 `dbx_add_connection` 没有这个入参，多传的键会被**静默丢弃** —— 每次查询都停在 `JDBC URL is required`。

结论：M1.5 不是「产品愿不愿意开闸」，是**上游能力缺口**。

## 复现配方（全隔离，不碰用户真实数据）

```bash
D=$(mktemp -d)
mkdir -p "$D/plugins" "$D/java"

# 1) 插件（来自桌面端自己的安装目录，17 MB）
cp -R ~/Library/Application\ Support/com.dbx.app/plugins/jdbc "$D/plugins/jdbc"

# 2) Java：上游已下载但未解包的 JRE
tar -xzf ~/.dbx/agents/jre-download.tar.gz -C "$D/java"
xattr -dr com.apple.quarantine "$D/java"      # 否则首次执行可能被拦
"$D/java/dbx-jre/bin/java" -version            # Temurin 21.0.12.1

# 3) 引擎（同 M0：自铸密钥 + 隔离 DBX_DATA_DIR）
DBX_DATA_DIR="$D" DBX_SECRET_KEY=<自铸 base64url 密钥> DBX_JAVA_BIN="$D/java/dbx-jre/bin/java" \
  <dbx-mcp 二进制>
```

探针：`m15-jdbc.mjs`（参数契约）、`m15-jdbc2.mjs`（+plugins/+Java）、`m15-jdbc3/4.mjs`（字段名试探）、`m15-tools.mjs`（工具清单）。

## 三步走的实测结果

| 步骤 | `<数据目录>/plugins/jdbc` | Java | `SELECT 1` 的结果 |
| --- | --- | --- | --- |
| 1 | 无 | 无 | `Plugin driver 'jdbc' is not installed` |
| 2 | 有 | 无 | `Plugin 'jdbc' exited with status exit status: 127` |
| 3 | 有 | 有 | `JDBC URL is required` |

第 2 步的引擎 stderr 逐字：

```
[2026-10-09T14:04:38Z WARN  dbx_plugin_runtime::plugins::runtime] [plugin:jdbc] Java runtime not found. Install Java or the optional DBX JDBC runtime.
```

第 3 步说明：**Java 一到位，插件就真的起来了**，链路只差 URL 传不进去。

## 被实测推翻的两个猜测

1. **「JDBC URL 填在 `database`」——错。** `database` 只是库名，填 URL 既不报错也到不了插件。
2. **「多传 `jdbcUrl` / `driverClass` / `connection_string` 就能过去」——错。**
   落库的 `config_json` 直接证伪（`jdbcUrl` / `driverClass` 连键都不存在）：

```json
{"db_type":"jdbc","driver_profile":null,"url_params":null,"host":"localhost","port":5432,
 "database":"postgres","connection_string":null,"external_config":null,
 "jdbc_driver_class":null,"jdbc_driver_paths":[], "save_password":true}
```

`connection_string` / `jdbc_driver_class` / `jdbc_driver_paths` / `url_params` 四个字段**永远**为 `null` 或 `[]`，
而 `dbx_add_connection` 的 10 个入参里没有它们。

## 已确证的引擎契约

- `jdbc` 建连入参：`required=[name,db_type,host]`，且 `port` 对该类型**实际必填** —— 不给就是 `Port is required for this database type.`
- `driver_profile` 是唯一能落库的扩展位（实测 `org.postgresql:postgresql:42.7.4` 被保留），但**只设它仍然报 `JDBC URL is required`**
- 25 个工具里只有 `dbx_add_connection` / `dbx_duplicate_connection` 会写连接；**没有任何工具能写 `connection_string`**
- 插件的启动脚本按 `DBX_JAVA_BIN` → `JAVA_HOME` → `/opt/homebrew/opt/openjdk` → `/usr/local/opt/openjdk` → `PATH` 顺序找 Java，全找不到才 `exit 127`

## 前置条件（三项，全部在 dbx-pro 之外）

| 条件 | 本机现状 | 说明 |
| --- | --- | --- |
| 引擎数据目录下有 `plugins/jdbc` | **无**（`~/.astravia-dbx-data/` 没有 `plugins/`） | 桌面端插件装在 `~/Library/Application Support/com.dbx.app/plugins/`，两个宿主各管各的目录 |
| Java 运行时 | **无**（`~/.dbx/agents/jre-21` 是 0 B 空目录，`state.json` 里 `jre_version: null`） | 上游下载了 34.5 MB 的 `jre-download.tar.gz` 但没解包 |
| `connection_string` 可写 | **不可** | 卡死点 |

## 未实测

| 项 | 为什么没测 |
| --- | --- |
| 桌面端 UI 建出来的 `jdbc` 连接在引擎里能否查询 | 需要动用户的真实 `com.dbx.app/dbx.db`，只读复制出来的库缺少 Keychain 密钥 |
| maven 驱动解析（`bin/dbx-maven-resolver`）的真实下载行为 | 链路没走到需要驱动那一步 |
| H2 内存库等免服务端 JDBC 目标 | 同上，卡在 URL 就进不去 |

## 结论与后续

M1.5 从「需要一个产品决策」升级为「**上游阻塞**」：只改 `DB_TYPE_MANIFEST` 与连接表单**做不出能用的功能**，
反而会把一个必然报错的入口暴露给用户。要打开这条路，必须先让上游在 `dbx_add_connection` 上暴露
`connection_string`（以及 `jdbc_driver_class` / `jdbc_driver_paths`），或提供等价的配置写入能力。
因此 M1.5 转入 M4 上游协作项；主线回到 M1（外置 SQL 化引擎 → 普通 PG 连接）。

## 遗留

- 若上游只愿意暴露 `connection_string` 而不暴露驱动字段，仍需验证驱动从哪来（`driver_profile` + maven resolver 是否足够）
