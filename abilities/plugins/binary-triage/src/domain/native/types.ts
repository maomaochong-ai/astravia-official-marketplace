export type NativeFormat = "elf" | "pe" | "macho";

export interface NativeSection {
	name: string;
	size: number;
	entropy: number;
	executable: boolean;
	writable: boolean;
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
	entryPoint: number;
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
