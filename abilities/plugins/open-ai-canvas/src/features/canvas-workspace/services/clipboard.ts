/**
 * 剪贴板写入。
 *
 * 为什么需要两层：宿主窗口在某些平台的焦点状态下 `navigator.clipboard` 不可用
 * （未聚焦、非安全上下文），这时 `writeText` 会 reject。用一个临时 textarea
 * 走 `execCommand` 是最后还能用的路径。两层都失败就返回 false，由调用方显示
 * 「复制失败」——不要静默失败，用户会以为是剪贴板坏了。
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底路径。
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
