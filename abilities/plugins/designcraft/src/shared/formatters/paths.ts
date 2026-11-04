/** Path shapes the host hands back in both directions; no filesystem access here. */

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}
