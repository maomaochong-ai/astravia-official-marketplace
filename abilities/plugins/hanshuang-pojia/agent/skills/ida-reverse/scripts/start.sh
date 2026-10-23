#!/usr/bin/env bash
# start.sh — macOS / Linux equivalent of start.ps1
#
# Starts the IDA Pro MCP bridge (`idalib-mcp`) in the background and waits for
# it to answer an MCP `tools/list`, printing exactly one of:
#
#   OK:<tool count>
#   ERR:idalib-mcp_not_found
#   ERR:IDADIR_not_found
#   ERR:timeout
#
# Usage:
#   ./start.sh [--port 13337] [--idadir /Applications/IDA...]
#
# IDA discovery order (first existing wins):
#   $IDADIR, /Applications/IDA Professional 9.x.app, /Applications/IDA Pro 9.x.app,
#   ~/ida, /opt/ida
#
# Port 13337 matches the PowerShell version so a payload written for Windows
# works unchanged after the agent switches platform.

set -euo pipefail

port=13337
idadir="${IDADIR:-}"

while [ "$#" -gt 0 ]; do
	case "$1" in
	--port)
		[ "$#" -ge 2 ] || {
			echo "option --port needs a value" >&2
			exit 2
		}
		port=$2
		shift 2
		;;
	--idadir)
		[ "$#" -ge 2 ] || {
			echo "option --idadir needs a value" >&2
			exit 2
		}
		idadir=$2
		shift 2
		;;
	-h | --help)
		echo "usage: $(basename "$0") [--port PORT] [--idadir DIR]" >&2
		exit 0
		;;
	*)
		echo "unknown option: $1" >&2
		exit 2
		;;
	esac
done

# IDA 的 macOS 安装目录带版本号，按版本从高到低试，避免写死某一个版本。
if [ -z "$idadir" ] || [ ! -d "$idadir" ]; then
	for candidate in \
		"/Applications/IDA Professional 9.3.app" \
		"/Applications/IDA Professional 9.2.app" \
		"/Applications/IDA Professional 9.1.app" \
		"/Applications/IDA Professional 9.0.app" \
		"/Applications/IDA Pro 9.0.app" \
		"/Applications/IDA Pro 8.4.app" \
		"$HOME/ida" \
		"/opt/ida"; do
		if [ -d "$candidate" ]; then
			idadir=$candidate
			break
		fi
	done
fi
result_ok=0

server_path=""
if command -v idalib-mcp >/dev/null 2>&1; then
	server_path=$(command -v idalib-mcp)
else
	# pip install idalib-mcp 常把入口脚本放进 python 的 bin/Scripts 目录，
	# 而该目录不一定在 PATH 里（尤其是 pyenv / Homebrew 混装时）。
	for candidate in \
		"$HOME/Library/Python/3.13/bin/idalib-mcp" \
		"$HOME/Library/Python/3.12/bin/idalib-mcp" \
		"$HOME/Library/Python/3.11/bin/idalib-mcp" \
		"$HOME/.local/bin/idalib-mcp" \
		"/usr/local/bin/idalib-mcp" \
		"/opt/homebrew/bin/idalib-mcp"; do
		if [ -x "$candidate" ]; then
			server_path=$candidate
			break
		fi
	done
fi

if [ -z "$server_path" ]; then
	echo "ERR:idalib-mcp_not_found"
	exit 1
fi
if [ -z "$idadir" ] || [ ! -d "$idadir" ]; then
	echo "ERR:IDADIR_not_found"
	exit 1
fi

export IDADIR=$idadir
# macOS 上 IDA 的 Python 运行时需要把 .app 内的 framework 加进 DYLD 搜索路径。
if [ "$(uname -s)" = "Darwin" ] && [ -d "$idadir/Contents/MacOS" ]; then
	export DYLD_FALLBACK_LIBRARY_PATH="$idadir/Contents/MacOS${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"
fi

# 清理旧进程（连同 worker 子进程），否则端口会被占住。
old_pids=$(pgrep -f 'idalib-mcp' || true)
if [ -n "$old_pids" ]; then
	for pid in $old_pids; do
		kill "$pid" 2>/dev/null || true
	done
	sleep 2
fi

nohup "$server_path" --host 127.0.0.1 --port "$port" >/tmp/idalib-mcp.log 2>&1 &
server_pid=$!

# 等待就绪：最多 15 秒，与 PowerShell 版一致。
for _ in $(seq 1 15); do
	sleep 1
	response=$(curl -s -X POST "http://127.0.0.1:$port/mcp" \
		-H 'Content-Type: application/json' \
		-d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null || true)
	[ -z "$response" ] && continue
	count=$(printf '%s' "$response" | python3 -c '
import json
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    print(0)
else:
    tools = payload.get("result", {}).get("tools", [])
    print(len(tools))
' 2>/dev/null || echo 0)
	if [ "${count:-0}" -gt 0 ] 2>/dev/null; then
		echo "OK:$count"
		result_ok=1
		break
	fi
done

if [ "$result_ok" -eq 0 ]; then
	# 启动失败时留下日志位置，便于下一步排查（stdout 契约仍只是 ERR:timeout）。
	echo "ERR:timeout"
	echo "see /tmp/idalib-mcp.log (pid $server_pid)" >&2
fi
