# Packed ELF loader — precedent

A stripped ELF whose real code is not in the file: a small stub decrypts or unpacks the
payload into memory and jumps to it. Everything you read before the dump describes the
loader, not the programme.

## When this precedent applies

- string coverage collapses to a handful of loader messages, and `.text` entropy is high;
- `readelf -lW` shows a segment that is both writable and executable, or a small stub calling
  `mmap(PROT_EXEC)`;
- the entry point is far from anything that looks like `main`;
- a known packer signature is present (UPX, or a commercial protector).

## Shape of the work

1. `triage_binary` for format, architecture, entropy and imports.
2. `list_code_symbols` to decide whether this is a normal stripped binary or a loader: a
   loader imports almost nothing beyond `mmap` / `mprotect` / `dlsym`.
3. `run_radare` (`info`, `functions`) on the entry point to find the unpacking loop.
4. Dump the unpacked image — in a sandbox, with the debugger, not by executing it on the host.
5. Re-run triage on the dump. That file is the actual subject; keep the original untouched.

## Traps

- Treating loader strings as the programme's capability. They describe packing, not purpose.
- Patching the packed file. The patch survives until the payload overwrites it.
- Reporting an offset from the packed file as if it were in the recovered image. Both have
  their own offsets; name which file an address belongs to.

## Evidence you must be able to show

A hash for the original and for the dump, the command that produced the dump, and the same
analysis run on both files with the difference stated.

## Tools

- [docs/method.md](docs/method.md) - the three signals in the order worth checking them (segment
  entropy, import surface, entry neighbourhood), and the point at which a dump is the cheaper move.

[`tools/elf_pack_scan.py`](tools/elf_pack_scan.py) turns those signals into numbers. It parses the
ELF and PE headers itself, prints each load segment with its entropy and W/X flags, finds packer
marker bytes with their offsets, and scores five signals: a stub marker, a write+execute segment, an
executable segment at or above an entropy floor, an import surface that names no libc function, and
an entry point outside every load segment. Every signal prints the evidence that fired it, because
the score is a reading aid - a stripped static binary can score without being packed.

```bash
cd tools
python3 elf_pack_scan.py --self-test
python3 elf_pack_scan.py --sample suspect.bin
python3 elf_pack_scan.py --sample a.bin,b.bin --min-entropy 7.0
```

Nothing is executed and nothing is written. Addresses in the report belong to the packed file, which
is the whole point of the case: an offset from the loader is not an offset in the recovered image.
[`tools/manifest.json`](tools/manifest.json) registers the tool for the scaffolder.
