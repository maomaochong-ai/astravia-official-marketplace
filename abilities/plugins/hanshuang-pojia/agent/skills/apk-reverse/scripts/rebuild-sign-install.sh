#!/usr/bin/env bash
# rebuild-sign-install.sh — macOS / Linux equivalent of rebuild-sign-install.ps1
#
# Rebuilds an apktool project, aligns it, signs it with a debug keystore and
# optionally installs it on a connected device. Same key=value summary:
#
#   unsigned_apk=, aligned_apk=, signed_apk=, keystore=, install_device=
#
# Usage:
#   ./rebuild-sign-install.sh <project-dir> [--out-dir DIR] [--name BASE]
#                             [--keystore PATH] [--key-alias ALIAS]
#                             [--store-pass PASS] [--key-pass PASS]
#                             [--device SERIAL] [--install] [--reinstall] [--clean]
#
# Tool discovery: PATH first, then the usual Android SDK locations
# ($ANDROID_HOME, $ANDROID_SDK_ROOT, ~/Library/Android/sdk on macOS,
# ~/Android/Sdk on Linux). The highest build-tools version wins, matching the
# PowerShell version's `Sort-Object Name -Descending`.
#
# The debug keystore is created on demand with keytool and the Android
# convention (alias androiddebugkey / password android).

set -euo pipefail

project_dir=""
out_dir=""
base_name=""
script_dir=$(cd "$(dirname "$0")" && pwd)
keystore_path="$script_dir/../debug.keystore"
key_alias="androiddebugkey"
store_pass="android"
key_pass="android"
device_serial=""
do_install=0
do_reinstall=0
do_clean=0

usage() {
	cat >&2 <<'USAGE'
usage: rebuild-sign-install.sh <project-dir> [--out-dir DIR] [--name BASE]
                               [--keystore PATH] [--key-alias ALIAS]
                               [--store-pass PASS] [--key-pass PASS]
                               [--device SERIAL] [--install] [--reinstall] [--clean]
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
	--out-dir)
		value_of "$@"
		out_dir=$2
		shift 2
		;;
	--name)
		value_of "$@"
		base_name=$2
		shift 2
		;;
	--keystore)
		value_of "$@"
		keystore_path=$2
		shift 2
		;;
	--key-alias)
		value_of "$@"
		key_alias=$2
		shift 2
		;;
	--store-pass)
		value_of "$@"
		store_pass=$2
		shift 2
		;;
	--key-pass)
		value_of "$@"
		key_pass=$2
		shift 2
		;;
	--device)
		value_of "$@"
		device_serial=$2
		shift 2
		;;
	--install)
		do_install=1
		shift
		;;
	--reinstall)
		do_reinstall=1
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
		if [ -n "$project_dir" ]; then
			die "unexpected extra argument: $1"
		fi
		project_dir=$1
		shift
		;;
	esac
done

if [ -z "$project_dir" ]; then
	usage
	exit 2
fi
[ -d "$project_dir" ] || die "Project directory not found: $project_dir"

# macOS 的 SDK 默认目录与 Linux 不同，两个都试；同时尊重 ANDROID_HOME。
sdk_roots=()
[ -n "${ANDROID_HOME:-}" ] && sdk_roots+=("$ANDROID_HOME")
[ -n "${ANDROID_SDK_ROOT:-}" ] && sdk_roots+=("$ANDROID_SDK_ROOT")
[ -d "$HOME/Library/Android/sdk" ] && sdk_roots+=("$HOME/Library/Android/sdk")
[ -d "$HOME/Android/Sdk" ] && sdk_roots+=("$HOME/Android/Sdk")

# 取版本号最大的 build-tools 目录；`sort -V` 在 macOS 的 BSD sort 上不存在，
# 所以用 numeric glob 排序代替（版本号均为 x.y.z，字典序与数值序一致）。
best_build_tools=""
for sdk in ${sdk_roots[@]+"${sdk_roots[@]}"}; do
	[ -d "$sdk/build-tools" ] || continue
	for candidate in "$sdk/build-tools"/*; do
		[ -d "$candidate" ] || continue
		if [ -z "$best_build_tools" ] || [ "$(basename "$candidate")" \> "$(basename "$best_build_tools")" ]; then
			best_build_tools=$candidate
		fi
	done
done

find_tool() {
	local name=$1
	if command -v "$name" >/dev/null 2>&1; then
		command -v "$name"
		return 0
	fi
	# apktool 常被装成 wrapper，没有可执行名时退到 PATH 之外的位置没有意义，
	# 这里只补 Android SDK 里的工具。
	local candidate=""
	case "$name" in
	zipalign)
		[ -n "$best_build_tools" ] && candidate="$best_build_tools/zipalign"
		;;
	apksigner)
		[ -n "$best_build_tools" ] && candidate="$best_build_tools/apksigner"
		;;
	adb)
		if [ -n "${ANDROID_HOME:-}" ] && [ -x "$ANDROID_HOME/platform-tools/adb" ]; then
			candidate="$ANDROID_HOME/platform-tools/adb"
		elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
			candidate="$HOME/Library/Android/sdk/platform-tools/adb"
		elif [ -x "$HOME/Android/Sdk/platform-tools/adb" ]; then
			candidate="$HOME/Android/Sdk/platform-tools/adb"
		fi
		;;
	keytool)
		[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ] && candidate="$JAVA_HOME/bin/keytool"
		;;
	apktool)
		candidate="$script_dir/../../../apktool/apktool"
		;;
	esac
	if [ -n "$candidate" ] && [ -e "$candidate" ]; then
		echo "$candidate"
		return 0
	fi
	die "Missing required CLI tool: $name"
}

apktool=$(find_tool apktool)
zipalign=$(find_tool zipalign)
apksigner=$(find_tool apksigner)
keytool=$(find_tool keytool)
adb=$(find_tool adb)

if [ ! -f "$keystore_path" ]; then
	mkdir -p "$(dirname "$keystore_path")"
	"$keytool" -genkeypair -v -keystore "$keystore_path" \
		-storepass "$store_pass" -keypass "$key_pass" \
		-alias "$key_alias" -keyalg RSA -keysize 2048 -validity 10000 \
		-dname 'CN=Android Debug,O=OpenCode,C=CN' ||
		die "Failed to generate debug keystore."
fi

if [ -z "$out_dir" ]; then
	out_dir=$(cd "$project_dir/.." && pwd)
fi
mkdir -p "$out_dir"

name=${base_name:-$(basename "$project_dir")}
unsigned_apk="$out_dir/$name-unsigned.apk"
aligned_apk="$out_dir/$name-aligned.apk"
signed_apk="$out_dir/$name-signed.apk"

if [ "$do_clean" -eq 1 ]; then
	rm -f "$unsigned_apk" "$aligned_apk" "$signed_apk"
fi

"$apktool" b "$project_dir" -o "$unsigned_apk" || die "apktool build failed."
"$zipalign" -f -p 4 "$unsigned_apk" "$aligned_apk" || die "zipalign failed."

cp -f "$aligned_apk" "$signed_apk"
"$apksigner" sign --ks "$keystore_path" --ks-key-alias "$key_alias" \
	--ks-pass "pass:$store_pass" --key-pass "pass:$key_pass" \
	--out "$signed_apk" "$aligned_apk" || die "apksigner sign failed."

"$apksigner" verify --print-certs "$signed_apk" || die "apksigner verify failed."

echo "unsigned_apk=$unsigned_apk"
echo "aligned_apk=$aligned_apk"
echo "signed_apk=$signed_apk"
echo "keystore=$keystore_path"

if [ "$do_install" -eq 1 ]; then
	install_args=()
	if [ -n "$device_serial" ]; then
		install_args+=("-s" "$device_serial")
	fi
	install_args+=("install")
	if [ "$do_reinstall" -eq 1 ]; then
		install_args+=("-r")
	fi
	install_args+=("$signed_apk")
	"$adb" "${install_args[@]}" || die "adb install failed."
	echo "install_device=$device_serial"
fi
