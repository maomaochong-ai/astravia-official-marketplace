/**
 * Icon — Iconify mask icon 薄壳。
 *
 * name 必须写完整 tailwind iconify class（例如 "icon-[lucide--database]"），
 * 这样 Tailwind 构建时才能扫描并生成。
 */

import type { JSX } from "react";

interface Props {
	name: string;
	className?: string;
}

export function Icon({ name, className = "size-3.5" }: Props): JSX.Element {
	return <span aria-hidden className={`${name} ${className} inline-block shrink-0`} />;
}
