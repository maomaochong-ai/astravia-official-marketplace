const FORMATS = ["APK", "AAB", "IPA", "DEX", "JAR", "ZIP", "ELF", "PE", "Mach-O", ".so / .dll / .dylib"];

/** 面板首屏用来说明「左边能选什么」：写死格式比一句「支持二进制」更能让人对上自己的文件。 */
export function SupportedFormats() {
	return (
		<div className="flex flex-wrap justify-center gap-1">
			{FORMATS.map(format => (
				<span
					key={format}
					className="rounded border border-black/[0.08] bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground/50 dark:border-white/10"
				>
					{format}
				</span>
			))}
		</div>
	);
}
