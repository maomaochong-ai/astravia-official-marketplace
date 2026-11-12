/**
 * The wordmark from upstream's launch screen (setup.go:banner).
 *
 * Kept byte-for-byte: the block letters are the product's face, and every row is
 * padded to the widest row so centering cannot ripple the letterforms apart.
 * Rendered in the brand green upstream prints it in.
 */

const BANNER = [
	" ███████╗████████╗██████╗ ██╗██╗  ██╗",
	" ██╔════╝╚══██╔══╝██╔══██╗██║╚██╗██╔╝",
	" ███████╗   ██║   ██████╔╝██║ ╚███╔╝ ",
	" ╚════██║   ██║   ██╔══██╗██║ ██╔██╗ ",
	" ███████║   ██║   ██║  ██║██║██╔╝ ██╗",
	" ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝",
];

const WIDTH = Math.max(...BANNER.map((row) => [...row].length));

export function StrixWordmark(): React.ReactElement {
	return (
		<pre className="astra-strix-wordmark" aria-label="Strix" data-width={WIDTH}>
			{BANNER.map((row) => row.padEnd(WIDTH, " ")).join("\n")}
		</pre>
	);
}
