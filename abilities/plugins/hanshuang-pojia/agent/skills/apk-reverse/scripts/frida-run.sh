#!/usr/bin/env bash
# frida-run.sh — macOS / Linux equivalent of frida-run.ps1
#
# Attaches a Frida script to an app, or spawns one, on a USB device or a
# remote frida-server. Same option names as the PowerShell version so the agent
# can switch platforms without rewriting the command:
#
#   --package <id>        app identifier to attach/spawn
#   --process <name>      process name to attach
#   --remote-host <h:p>   frida-server address (default 127.0.0.1:27042)
#   --script <path>       JavaScript payload (.js)
#   --usb                 use the USB device (-U) instead of remote (-H)
#   --spawn               spawn the target instead of attaching (-f / -n)
#   --pause               keep the session paused after load (drops --no-pause)
#   --list-devices        print id<TAB>type<TAB>name for every device
#   --list-processes      print pid<TAB>name for the selected device
#
# Usage:
#   ./frida-run.sh --usb --package com.demo --script hook.js --spawn
#
# Requires frida-tools (`pip install frida-tools`). The Python fallback is used
# for --list-devices / --list-processes because those have no stable CLI form.

set -euo pipefail

package_id=""
process_name=""
remote_host="127.0.0.1:27042"
script_path=""
use_usb=0
do_spawn=0
do_pause=0
list_devices=0
list_processes=0

usage() {
	cat >&2 <<'USAGE'
usage: frida-run.sh [--package ID | --process NAME] [--script PATH]
                    [--remote-host HOST:PORT] [--usb] [--spawn] [--pause]
                    [--list-devices] [--list-processes]
USAGE
}

die() {
	echo "$1" >&2
	exit 1
}

# 每个选项都要求紧跟一个值；缺值时报错退出，避免把下一个选项当成参数。
value_of() {
	if [ "$#" -lt 2 ] || [ -z "$2" ]; then
		die "option $1 needs a value"
	fi
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--package)
		value_of "$@"
		package_id=$2
		shift 2
		;;
	--process)
		value_of "$@"
		process_name=$2
		shift 2
		;;
	--remote-host)
		value_of "$@"
		remote_host=$2
		shift 2
		;;
	--script)
		value_of "$@"
		script_path=$2
		shift 2
		;;
	--usb)
		use_usb=1
		shift
		;;
	--spawn)
		do_spawn=1
		shift
		;;
	--pause)
		do_pause=1
		shift
		;;
	--list-devices)
		list_devices=1
		shift
		;;
	--list-processes)
		list_processes=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "unknown option: $1" >&2
		usage
		exit 2
		;;
	esac
done

need() {
	command -v "$1" >/dev/null 2>&1 || die "Missing required CLI tool: $1 (install frida-tools: pip install frida-tools)"
}

need python3
need frida
need frida-ps

if [ "$list_devices" -eq 1 ]; then
	# 设备枚举只在 Python 绑定里稳定，CLI 的 frida-ls-devices 输出格式随版本变化。
	python3 -c 'import frida; [print("%s\t%s\t%s" % (d.id, d.type, d.name)) for d in frida.enumerate_devices()]'
	exit $?
fi

target=$package_id
[ -z "$target" ] && target=$process_name
if [ -z "$target" ] && [ "$list_processes" -eq 0 ]; then
	die "Provide --package or --process, or use --list-processes."
fi

if [ "$list_processes" -eq 1 ]; then
	if [ "$use_usb" -eq 1 ]; then
		python3 -c 'import frida; [print("%s\t%s" % (p.pid, p.name)) for p in frida.get_usb_device().enumerate_processes()]'
	else
		python3 -c '
import sys
import frida

host = sys.argv[1]
device = frida.get_device_manager().add_remote_device(host)
for process in device.enumerate_processes():
    print("%s\t%s" % (process.pid, process.name))
' "$remote_host"
	fi
	exit $?
fi

if [ ! -f "$script_path" ]; then
	die "Frida script not found: $script_path"
fi

frida_args=()
if [ "$use_usb" -eq 1 ]; then
	frida_args+=("-U")
else
	frida_args+=("-H" "$remote_host")
fi
if [ "$do_spawn" -eq 1 ]; then
	frida_args+=("-f" "$target")
else
	frida_args+=("-n" "$target")
fi
frida_args+=("-l" "$script_path")
if [ "$do_pause" -eq 0 ]; then
	frida_args+=("--no-pause")
fi

exec frida "${frida_args[@]}"
