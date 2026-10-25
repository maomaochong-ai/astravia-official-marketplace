#!/bin/sh
# 用默认浏览器打开随包安装的图文介绍页。路径按脚本自身位置解析，不依赖当前目录。
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
skill_dir=$(dirname -- "$script_dir")
page="$skill_dir/assets/preview/index.html"

if [ ! -f "$page" ]; then
  echo "找不到介绍页：$page" >&2
  echo "请确认技能包完整（应包含 assets/preview/index.html）。" >&2
  exit 1
fi

echo "介绍页：$page"

case "$(uname -s)" in
  Darwin)
    open "$page"
    ;;
  Linux)
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$page" >/dev/null 2>&1
    else
      echo "未找到 xdg-open，请手动用浏览器打开上面的路径。" >&2
      exit 0
    fi
    ;;
  *)
    echo "当前系统没有可用的打开命令，请手动用浏览器打开上面的路径。" >&2
    ;;
esac
