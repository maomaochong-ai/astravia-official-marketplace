# Method — recovering a packed ELF

No offsets, hashes or addresses are recorded here on purpose: they belong to the sample you
are examining, and inventing them would be worse than omitting them. What is recorded is the
order of steps and the decision points.

## 1. Decide whether it is packed at all

Three cheap signals, in this order:

1. **Entropy per section.** `run_radare` (`info`) or `triage_binary` gives it. A `.text` that
   sits near the top of the scale next to a tiny import table is the classic shape.
2. **Import surface.** A programme with a string-dump feature imports string functions. A
   loader imports memory functions: `mmap`, `mprotect`, `madvise`, `dlopen`, `dlsym`.
3. **Entry-point neighbourhood.** `disassemble_range` at the entry point. If the first dozen
   instructions set up a loop over a data segment and end in a computed jump, stop looking for
   `main` in this file.

`list_code_symbols` settles the question for stripped files: if the dynamic symbol table has
almost nothing beyond the loader's own needs, there is nothing to analyse until you dump.

## 2. Find the unpacking loop

The loop is where the file's own bytes are read as data and written as code. Look for:

- a `memcpy`-like inner loop whose source is an address inside the image;
- a size constant that matches a segment's file size rather than its memory size;
- `mprotect` with exec permission called after the copy;
- a tail call through a register loaded from the destination.

Record the address of the loop **in the packed file** and say so explicitly in the evidence.

## 3. Dump, don't run

Dump the destination range after the copy and before the jump. Two acceptable ways: a debugger
breakpoint at the computed jump with a memory dump, or a sandboxed run whose only output is the
dump. Running the sample on the analysis host is not one of them.

Hash both files immediately:

```
shasum -a 256 packed.bin unpacked.bin
```

## 4. Re-analyse the dump

Everything from here is ordinary binary work: `list_code_symbols`, `decompile_function`,
`run_radare`. The one discipline that matters is attribution — each finding states whether the
address is in `packed.bin` or `unpacked.bin`. A report that mixes the two cannot be reproduced.

## 5. Say what stayed unknown

If the payload is itself protected (virtualised, layered), say so and stop. A partial dump that
is honestly labelled is evidence; a guessed reconstruction is not.
