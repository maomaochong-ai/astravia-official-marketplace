#!/usr/bin/env bash
# decode.sh — macOS / Linux equivalent of decode.ps1
#
# Decodes an APK with jadx (Java sources) and apktool (resources + smali) into
# the same layout and prints the same key=value summary:
#
#   <out-root>/<name>/jadx      readable Java
#   <out-root>/<name>/apktool   resources, smali*, lib/*.so
#
#   task_root=, jadx_out=, apktool_out=, package=, jadx_exit_code=,
#   apktool_exit_code=, java_files=, smali_dirs=, so_files=, xml_files=
#   warning=...   (only when a decoder returned non-zero)
#
# Usage:
#   ./decode.sh app.apk [--name TASK] [--out-root DIR] [--skip-jadx]
#                       [--skip-apktool] [--clean]
#
# Notes:
#   * A non-zero exit from jadx or apktool is reported in the summary instead of
#     aborting: partial output is still useful for triage, and the agent decides
#     from java_files / smali_dirs whether the decode was good enough.
#   * jadx and apktool both need a JRE; the script checks for it up front so the
#     failure message names the real cause.

set -euo pipefail

apk_path=""
task_name=""
out_root=""
skip_jadx=0
skip_apktool=0
do_clean=0

usage() {
	cat >&2 <<'USAGE'
usage: decode.sh <app.apk> [--name TASK] [--out-root DIR]
                 [--skip-jadx] [--skip-apktool] [--clean]
USAGE
}

die() {
	echo "$1" >&2
	exit 1
}

value_of() {
	if [ "$#" -lt 2 ] || [ -z "$2" ]; then
		die "option $1 needs a value"
	fi
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--name)
		value_of "$@"
		task_name=$2
		shift 2
		;;
	--out-root)
		value_of "$@"
		out_root=$2
		shift 2
		;;
	--skip-jadx)
		skip_jadx=1
		shift
		;;
	--skip-apktool)
		skip_apktool=1
		shift
		;;
	--clean)
		do_clean=1
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
		if [ -n "$apk_path" ]; then
			die "unexpected extra argument: $1"
		fi
		apk_path=$1
		shift
		;;
	esac
done

if [ -z "$apk_path" ]; then
	usage
	exit 2
fi
if [ ! -f "$apk_path" ]; then
	die "APK not found: $apk_path"
fi

need() {
	command -v "$1" >/dev/null 2>&1 || die "Missing required CLI tool: $1"
}

# 输入路径统一成绝对路径；jadx/apktool 在子目录里跑，相对路径会失效。
case "$apk_path" in
/*) apk_abs=$apk_path ;;
*) apk_abs="$(cd "$(dirname "$apk_path")" && pwd)/$(basename "$apk_path")" ;;
esac

command -v java >/dev/null 2>&1 || die "Missing required CLI tool: java (both jadx and apktool need a JRE)"
if [ "$skip_jadx" -eq 0 ]; then need jadx; fi
if [ "$skip_apktool" -eq 0 ]; then need apktool; fi

if [ -n "$task_name" ]; then
	name=$task_name
else
	# 去掉扩展名，再把不安全字符换成下划线，与 PowerShell 版同规则。
	name=$(basename "$apk_abs")
	name=${name%.*}
	[ -z "$name" ] && name=apk
	name=$(printf '%s' "$name" | tr -c 'A-Za-z0-9._-' '_')
fi

if [ -n "$out_root" ]; then
	resolved_out_root=$out_root
else
	resolved_out_root=$(dirname "$apk_abs")
	[ -z "$resolved_out_root" ] && resolved_out_root=$(pwd)
fi

task_root="$resolved_out_root/$name"
jadx_out="$task_root/jadx"
apktool_out="$task_root/apktool"

mkdir -p "$resolved_out_root"
if [ "$do_clean" -eq 1 ] && [ -e "$task_root" ]; then
	rm -rf "$task_root"
fi
mkdir -p "$task_root"

jadx_exit_code=""
if [ "$skip_jadx" -eq 0 ]; then
	rm -rf "$jadx_out"
	# `set -e` 会把非零退出直接抛出去，所以这里显式吞掉退出码。
	set +e
	jadx -d "$jadx_out" "$apk_abs"
	jadx_exit_code=$?
	set -e
else
	jadx_exit_code=""
fi

apktool_exit_code=""
if [ "$skip_apktool" -eq 0 ]; then
	rm -rf "$apktool_out"
	set +e
	apktool d "$apk_abs" -o "$apktool_out" -f
	apktool_exit_code=$?
	set -e
else
	apktool_exit_code=""
fi

manifest_path="$apktool_out/AndroidManifest.xml"
package_name=""
if [ "$skip_apktool" -eq 0 ] && [ -f "$manifest_path" ]; then
	# 解析失败不影响主流程：包名只是摘要里的一行。
	package_name=$(python3 - "$manifest_path" <<'PY' 2>/dev/null || true
import sys
import xml.etree.ElementTree as ET

try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception:
    print("")
else:
    print(root.get("package", "") or "")
PY
)
fi

java_files=0
if [ -d "$jadx_out" ]; then
	java_files=$(find "$jadx_out" -type f -name '*.java' | wc -l | tr -d ' ')
fi

smali_dirs=0
if [ -d "$apktool_out" ]; then
	smali_dirs=$(find "$apktool_out" -maxdepth 1 -type d -name 'smali*' | wc -l | tr -d ' ')
fi

so_files=0
if [ -d "$apktool_out" ]; then
	so_files=$(find "$apktool_out" -type f -name '*.so' | wc -l | tr -d ' ')
fi

xml_files=0
if [ -d "$apktool_out" ]; then
	xml_files=$(find "$apktool_out" -type f -name '*.xml' | wc -l | tr -d ' ')
fi

echo "task_root=$task_root"
echo "jadx_out=$jadx_out"
echo "apktool_out=$apktool_out"
echo "package=$package_name"
echo "jadx_exit_code=$jadx_exit_code"
echo "apktool_exit_code=$apktool_exit_code"
echo "java_files=$java_files"
echo "smali_dirs=$smali_dirs"
echo "so_files=$so_files"
echo "xml_files=$xml_files"

if { [ -n "$jadx_exit_code" ] && [ "$jadx_exit_code" -ne 0 ]; } ||
	{ [ -n "$apktool_exit_code" ] && [ "$apktool_exit_code" -ne 0 ]; }; then
	echo "warning=decoder returned non-zero exit code; inspect output but treat exported sources as usable if present"
fi
