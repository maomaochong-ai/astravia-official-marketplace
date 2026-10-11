/**
 * Iconify mask icon. `name` must be a full utility class written literally at
 * the call site — e.g. name="icon-[lucide--database]" — so Tailwind can emit it.
 * Only lucide / tabler / mdi / simple-icons exist offline.
 */
export default function Icon({
	name,
	className = "size-3.5",
}: {
	name: string;
	className?: string;
}) {
	return <span aria-hidden className={`${name} ${className} inline-block shrink-0`} />;
}
