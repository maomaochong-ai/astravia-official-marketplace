import { useMemo } from "react";
import { parseMarkdown, type MdBlock, type MdInline } from "../../services/markdown";

function Inlines({ nodes }: { nodes: MdInline[] }) {
	return (
		<>
			{nodes.map((node, index) => {
				switch (node.kind) {
					case "code":
						return (
							<code key={index} className="rounded border border-line-subtle bg-surface-3 px-1 py-[1px] font-mono text-[11px] text-text">
								{node.text}
							</code>
						);
					case "strong":
						return (
							<strong key={index} className="font-semibold text-text">
								{node.text}
							</strong>
						);
					case "em":
						return (
							<em key={index} className="italic text-text-2">
								{node.text}
							</em>
						);
					case "link":
						return (
							<a key={index} href={node.href} target="_blank" rel="noreferrer noopener" className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid">
								{node.text}
							</a>
						);
					default:
						return <span key={index}>{node.text}</span>;
				}
			})}
		</>
	);
}

const HEADING_CLASS = ["text-[15px] font-semibold text-text", "text-[13.5px] font-semibold text-text", "text-[12.5px] font-semibold text-text", "text-[11.5px] font-semibold uppercase tracking-wide text-text-2", "text-[11px] font-semibold uppercase tracking-wide text-text-2", "text-[11px] text-text-2"];

function Block({ block }: { block: MdBlock }) {
	switch (block.kind) {
		case "heading": {
			const className = HEADING_CLASS[Math.min(block.level, 6) - 1];
			const body = <Inlines nodes={block.inlines} />;
			if (block.level === 1) return <h1 className={`${className} mt-4 first:mt-0`}>{body}</h1>;
			if (block.level === 2) return <h2 className={`${className} mt-4 border-b border-line-subtle pb-1 first:mt-0`}>{body}</h2>;
			return <h3 className={`${className} mt-3 first:mt-0`}>{body}</h3>;
		}
		case "paragraph":
			return (
				<p className="text-[12px] leading-[1.75] text-text-2">
					<Inlines nodes={block.inlines} />
				</p>
			);
		case "code":
			return (
				<div className="overflow-hidden rounded border border-line-subtle bg-surface">
					{block.lang ? <div className="border-b border-line-subtle px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wide text-text-4">{block.lang}</div> : null}
					<pre className="fb-scroll overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-[1.6] text-text-2">{block.text}</pre>
				</div>
			);
		case "list":
			return block.ordered ? (
				<ol className="flex list-decimal flex-col gap-1 pl-5 text-[12px] leading-[1.7] text-text-2">
					{block.items.map((item, index) => (
						<li key={index}>
							<Inlines nodes={item} />
						</li>
					))}
				</ol>
			) : (
				<ul className="flex list-disc flex-col gap-1 pl-5 text-[12px] leading-[1.7] text-text-2">
					{block.items.map((item, index) => (
						<li key={index}>
							<Inlines nodes={item} />
						</li>
					))}
				</ul>
			);
		case "table":
			return (
				<div className="fb-scroll overflow-x-auto rounded border border-line-subtle">
					<table className="w-full border-collapse text-left text-[11.5px]">
						<thead className="bg-surface-3">
							<tr>
								{block.head.map((cell, index) => (
									<th key={index} className="border-b border-line-subtle px-2.5 py-1.5 font-semibold text-text">
										<Inlines nodes={cell} />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row, rowIndex) => (
								<tr key={rowIndex} className="even:bg-surface-2">
									{row.map((cell, cellIndex) => (
										<td key={cellIndex} className="border-b border-line-subtle px-2.5 py-1.5 align-top text-text-2">
											<Inlines nodes={cell} />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
		case "quote":
			return (
				<blockquote className="border-l-2 border-line-strong pl-3 text-text-2">
					<div className="flex flex-col gap-2">
						{block.blocks.map((inner, index) => (
							<Block key={index} block={inner} />
						))}
					</div>
				</blockquote>
			);
		default:
			return <hr className="border-line-subtle" />;
	}
}

/** 把一篇 Markdown 渲染成与工作台其它页面同一套排版。 */
export function Markdown({ source }: { source: string }) {
	const blocks = useMemo(() => parseMarkdown(source), [source]);
	return (
		<div className="flex flex-col gap-2.5">
			{blocks.map((block, index) => (
				<Block key={index} block={block} />
			))}
		</div>
	);
}
