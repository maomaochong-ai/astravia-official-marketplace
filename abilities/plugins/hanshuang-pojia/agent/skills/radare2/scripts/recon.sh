#!/usr/bin/env bash
# recon.sh — macOS / Linux equivalent of recon.ps1
#
# Runs the same rabin2 sections in the same order, with the same limits, so the
# agent can grep the output identically on every platform:
#
#   目标文件: <absolute path>
#   === 基本信息 ===   rabin2 -I
#   === 节区 ===       rabin2 -S
#   === 导入 ===       rabin2 -i   (first --imports lines)
#   === 导出 ===       rabin2 -E
#   === 字符串 ===     rabin2 -zz  (first --strings lines)
#   === 函数与入口分析 === r2 -A -q -c 's entry0;afl;iz;ii;q'   (only with --analyze)
#
# Usage:
#   ./recon.sh <binary> [--strings N] [--imports N] [--analyze]
#
# Notes:
#   * Paths are resolved to absolute before calling rabin2/r2, because both
#     tools mis-handle relative paths when the CWD changes.
#   * Every command is invoked with `--` so a target named like a flag cannot
#     be read as an option.

set -euo pipefail

target_path=""
strings_limit=40
imports_limit=80
run_analysis=0

usage() {
	echo "usage: $(basename "$0") <binary> [--strings N] [--imports N] [--analyze]" >&2
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--strings)
		strings_limit=$2
		shift 2
		;;
	--imports)
		imports_limit=$2
		shift 2
		;;
	--analyze)
		run_analysis=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	-*)
		echo "unknown option: $1" >&2
		usage
		exit 2
		;;
	*)
		if [ -n "$target_path" ]; then
			echo "unexpected extra argument: $1" >&2
			exit 2
		fi
		target_path=$1
		shift
		;;
	esac
done

if [ -z "$target_path" ]; then
	usage
	exit 2
fi
if [ ! -e "$target_path" ]; then
	# 与 PowerShell 版一样在第一步就失败，避免输出到一半才报错。
	echo "目标文件不存在: $target_path" >&2
	exit 1
fi

need() {
	command -v "$1" >/dev/null 2>&1 || {
		echo "缺少命令：$1" >&2
		exit 1
	}
}

need rabin2
if [ "$run_analysis" -eq 1 ]; then
	need r2
fi

# 规范化成绝对路径，避免 r2/rabin2 在相对路径下歧义解析。
case "$target_path" in
/*) target=$target_path ;;
*) target="$(cd "$(dirname "$target_path")" && pwd)/$(basename "$target_path")" ;;
esac

section() {
	echo ""
	echo "=== $1 ==="
}

echo "目标文件: $target"

section "基本信息"
rabin2 -I -- "$target"

section "节区"
rabin2 -S -- "$target"

section "导入"
rabin2 -i -- "$target" | head -n "$imports_limit"

section "导出"
rabin2 -E -- "$target"

section "字符串"
rabin2 -zz -- "$target" | head -n "$strings_limit"

if [ "$run_analysis" -eq 1 ]; then
	section "函数与入口分析"
	r2 -A -q -c 's entry0;afl;iz;ii;q' -- "$target"
fi
