export type NativeFormat = "elf" | "pe" | "macho";

export interface NativeSection {
	name: string;
	size: number;
	entropy: number;
	executable: boolean;
	writable: boolean;
	/** 该节内容在文件里的起始偏移；解析器拿不到时为 undefined。 */
	offset?: number;
	/** 该节在地址空间里的起始地址（ELF/Mach-O 为虚拟地址，PE 为 RVA）。 */
	vaddr?: number;
}

export interface NativeImportGroup {
	library: string;
	functions: string[];
}

/**
 * 跨格式归一后的原生二进制事实。审计规则只读这个结构，
 * 因此新增一种容器格式不会牵动规则层。
 */
export interface NativeFacts {
	format: NativeFormat;
	arch: string;
	bits: 32 | 64;
	endianness: "little" | "big";
	kind: string;
	/** 入口点地址，语义跟各格式一致（ELF/Mach-O 虚拟地址、PE 的 RVA）。 */
	entryPoint: number;
	/** 入口点对应的文件偏移；未知 / 无入口时为 null。深层分析从文件偏移工作。 */
	entryOffset?: number | null;
	pie: boolean | null;
	executableStack: boolean | null;
	nxCompat: boolean | null;
	signed: boolean | null;
	stripped: boolean | null;
	dotnet: boolean;
	interpreter: string | null;
	sections: NativeSection[];
	imports: NativeImportGroup[];
	libraries: string[];
	notes: string[];
}

export interface Parsed<T> {
	value: T | null;
	warnings: string[];
}

export function parsed<T>(value: T, warnings: string[] = []): Parsed<T> {
	return { value, warnings };
}

export function failed<T>(warning: string): Parsed<T> {
	return { value: null, warnings: [warning] };
}

export function describeError(error: unknown): string {
	if (error instanceof RangeError) return `数据越界：${error.message}`;
	if (error instanceof Error) return error.message;
	return String(error);
}

export const ELF_MACHINES: Record<number, string> = {
	0x02: "sparc",
	0x03: "x86",
	0x08: "mips",
	0x14: "ppc",
	0x15: "ppc64",
	0x28: "arm",
	0x2a: "superh",
	0x32: "ia64",
	0x3e: "x86-64",
	0x53: "avr",
	0xb7: "aarch64",
	0xf3: "riscv",
	0xf7: "bpf",
};

export const PE_MACHINES: Record<number, string> = {
	0x014c: "x86",
	0x0166: "mips",
	0x01c0: "arm",
	0x01c2: "thumb",
	0x01c4: "armv7",
	0x0200: "ia64",
	0x8664: "x86-64",
	0xaa64: "arm64",
	0x5032: "riscv32",
	0x5064: "riscv64",
};

export const MACHO_CPUS: Record<number, string> = {
	7: "x86",
	0x01000007: "x86-64",
	12: "arm",
	0x0100000c: "arm64",
	0x0200000c: "arm64_32",
	18: "ppc",
	0x01000012: "ppc64",
};
