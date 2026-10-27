#!/usr/bin/env bash
# open.sh — macOS / Linux equivalent of open.ps1
#
# Opens a binary in IDA through the idalib-mcp HTTP bridge and waits until the
# session reports `is_analyzing: false`. Output contract is identical to the
# PowerShell version, one line per event:
#
#   OK:<filename>:<session_id>[ (temp copy)]
#   INFO:opening:<elapsed>/<timeout>s        (every 10 s while waiting)
#   ERR:file_not_found | ERR:invalid_timeout | ERR:open_timeout_<N>s | ERR:<message>
#
# Usage:
#   ./open.sh <binary> [--session-id ID] [--no-auto-analysis]
#                     [--timeout N] [--port 13337]
#
# Why the temp-copy dance:
#   IDA refuses to open a target whose stale .id0/.i64 files are still locked by
#   another IDA instance. Instead of failing, a GUID-prefixed copy is made under
#   $TMPDIR/nx-ida and opened instead, and the OK line says ` (temp copy)` so the
#   caller knows the analysis does not belong to the original path.
#
# System binaries are copied to temp as well: on macOS a hardened/runtime target
# under /System or /usr cannot be opened in place, and IDA would otherwise fail
# with a permission error that looks like a bridge bug.

set -uo pipefail

port=13337
session_id=""
timeout_seconds=120
auto_analysis=true
target_path=""

usage() {
	cat >&2 <<'USAGE'
usage: open.sh <binary> [--session-id ID] [--no-auto-analysis]
                        [--timeout N] [--port PORT]
USAGE
}

die() {
	echo "ERR:$1"
	exit 1
}

value_of() {
	if [ "$#" -lt 2 ] || [ -z "$2" ]; then
		die "missing_value_for_$1"
	fi
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--session-id)
		value_of "$@"
		session_id=$2
		shift 2
		;;
	--timeout)
		value_of "$@"
		timeout_seconds=$2
		shift 2
		;;
	--port)
		value_of "$@"
		port=$2
		shift 2
		;;
	--no-auto-analysis)
		auto_analysis=false
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	-*)
		echo "ERR:unknown_option_$1"
		exit 2
		;;
	*)
		if [ -n "$target_path" ]; then
			die "unexpected_extra_argument"
		fi
		target_path=$1
		shift
		;;
	esac
done

[ -n "$target_path" ] || {
	usage
	exit 2
}
[ -f "$target_path" ] || die "file_not_found"
[ "$timeout_seconds" -gt 0 ] 2>/dev/null || die "invalid_timeout"

temp_dir="${TMPDIR:-/tmp}/nx-ida"
mkdir -p "$temp_dir"

# 判断是否已经是临时副本，避免递归复制。
is_temp_copy=0
case "$target_path" in
"$temp_dir"/*) is_temp_copy=1 ;;
esac

# 系统目录里的目标在 macOS/Linux 上通常不可原地打开（SIP/SELinux 或只读挂载）。
if [ "$is_temp_copy" -eq 0 ]; then
	case "$target_path" in
	/System/* | /usr/lib/* | /usr/bin/* | /usr/sbin/* | /bin/* | /sbin/*)
		filename=$(basename "$target_path")
		temp_path="$temp_dir/$filename"
		if cp -f "$target_path" "$temp_path" 2>/dev/null; then
			target_path=$temp_path
			is_temp_copy=1
		fi
		;;
	esac
fi

# 清理同名旧数据库文件；清不掉说明被别的 IDA 实例锁着，改用临时副本。
if [ "$is_temp_copy" -eq 0 ]; then
	dir=$(dirname "$target_path")
	base=$(basename "$target_path")
	base=${base%.*}
	has_locked=0
	for ext in .id0 .id1 .id2 .nam .til .i64; do
		file="$dir/$base$ext"
		if [ -e "$file" ]; then
			rm -f "$file" 2>/dev/null
			[ -e "$file" ] && has_locked=1
		fi
	done
	if [ "$has_locked" -eq 1 ]; then
		guid=$(uuidgen | tr -d '-' | cut -c1-8)
		temp_path="$temp_dir/$guid-$(basename "$target_path")"
		cp -f "$target_path" "$temp_path" || die "copy_to_temp_failed"
		target_path=$temp_path
		is_temp_copy=1
	fi
fi

if [ -z "$session_id" ]; then
	session_id=$(uuidgen | tr -d '-' | cut -c1-8)
fi

json_escape() {
	printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1], end="")'
}

escaped_path=$(json_escape "$target_path")
body=$(printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"idalib_open","arguments":{"input_path":"%s","run_auto_analysis":%s,"session_id":"%s"}}}' \
	"$escaped_path" "$auto_analysis" "$session_id")

# session 就绪判断：三条命中规则与 PowerShell 版一致（session_id / 完整路径 / 同名文件）。
ready_session() {
	curl -s --max-time 10 -X POST "http://127.0.0.1:$port/mcp" \
		-H 'Content-Type: application/json' \
		-d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"idalib_list","arguments":{}}}' 2>/dev/null |
		python3 - "$session_id" "$target_path" <<'PY'
import json
import os
import sys

expected_session = sys.argv[1]
expected_path = sys.argv[2]
expected_name = os.path.basename(expected_path)

try:
    payload = json.load(sys.stdin)
except Exception:
    raise SystemExit(0)

sessions = payload.get("result", {}).get("structuredContent", {}).get("sessions") or []
for session in sessions:
    if not session:
        continue
    same_session = session.get("session_id") == expected_session
    same_path = session.get("input_path") == expected_path
    same_file = os.path.basename(session.get("input_path") or "") == expected_name
    if (same_session or same_path or same_file) and session.get("is_analyzing") is False:
        print("%s:%s" % (session.get("filename") or expected_name, session.get("session_id") or ""))
        break
PY
}

tag=""
[ "$is_temp_copy" -eq 1 ] && tag=" (temp copy)"

# 打开请求放到后台：idalib_open 在自动分析期间可能长时间不回包。
response_file="$temp_dir/.open-$session_id.json"
rm -f "$response_file"
(
	curl -s --max-time "$timeout_seconds" -X POST "http://127.0.0.1:$port/mcp" \
		-H 'Content-Type: application/json' \
		-d "$body" -o "$response_file" 2>/dev/null
) &
curl_pid=$!

start_time=$SECONDS
deadline=$((start_time + timeout_seconds))
last_progress=$((start_time - 10))

while [ "$SECONDS" -lt "$deadline" ]; do
	hit=$(ready_session)
	if [ -n "$hit" ]; then
		kill "$curl_pid" 2>/dev/null
		echo "OK:$hit$tag"
		exit 0
	fi

	# 请求可能立刻失败（桥接没起、端口不通）。这时不要傻等满超时，
	# 直接把桥接返回的错误原文报上去，省掉一次几分钟的空等。
	if ! kill -0 "$curl_pid" 2>/dev/null; then
		if [ ! -s "$response_file" ]; then
			echo "ERR:bridge_unreachable"
			exit 1
		fi
		failure=$(python3 - "$response_file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(0)

content = payload.get("result", {}).get("structuredContent") or {}
if content.get("success") is True:
    session = content.get("session") or {}
    print("OK:%s:%s" % (session.get("filename", ""), session.get("session_id", "")))
else:
    print("ERR:%s" % (content.get("error") or "open_failed"))
PY
		)
		if [ -n "$failure" ]; then
			echo "$failure$tag"
			case "$failure" in
			OK:*) exit 0 ;;
			*) exit 1 ;;
			esac
		fi
	fi


	# 请求可能立刻失败（桥接没起、端口不通）。这时不要傻等满超时，
	# 直接把桥接返回的错误原文报上去，省掉一次几分钟的空等。
	if [ -s "$response_file" ] && ! kill -0 "$curl_pid" 2>/dev/null; then
		failure=$(python3 - "$response_file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as handle:
        payload = json.load(handle)
except Exception:
    raise SystemExit(0)

content = payload.get("result", {}).get("structuredContent") or {}
if content.get("success") is True:
    session = content.get("session") or {}
    print("OK:%s:%s" % (session.get("filename", ""), session.get("session_id", "")))
else:
    print("ERR:%s" % (content.get("error") or "open_failed"))
PY
		)
		if [ -n "$failure" ]; then
			echo "$failure$tag"
			case "$failure" in
			OK:*) exit 0 ;;
			*) exit 1 ;;
			esac
		fi
	fi

	if [ $((SECONDS - last_progress)) -ge 10 ]; then
		echo "INFO:opening:$((SECONDS - start_time))/${timeout_seconds}s"
		last_progress=$SECONDS
	fi

	sleep 2
done

# 超时后最后再确认一次：分析刚结束的会话不该被判成失败。
hit=$(ready_session)
if [ -n "$hit" ]; then
	kill "$curl_pid" 2>/dev/null
	echo "OK:$hit$tag"
	exit 0
fi

kill "$curl_pid" 2>/dev/null
echo "ERR:open_timeout_${timeout_seconds}s"
exit 1
