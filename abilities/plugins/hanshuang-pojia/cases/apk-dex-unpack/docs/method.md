# Method — recovering sources from a packed APK

Class names, offsets and hashes stay out of this document: they belong to the sample in front of
you. What follows is the order of decisions and the checks that keep the result honest.

## 1. Establish that the code is missing, not that the tool failed

`decompile_android` returning a stub is only meaningful next to a second signal:

- `search_dex_symbols` shows the package prefix but almost no methods under it;
- the manifest's application class forwards to a library or to a class that is not in the DEX;
- `assets/` or `lib/<abi>/` is large relative to `classes*.dex`.

Two of the three means packed. One means keep looking before you escalate to dynamic work.

## 2. Name the loader

The shell has to call something. Typical anchors:

- `System.loadLibrary` in the application class;
- a `ProxyApplication` / `StubApp` / `AppComponentFactory` reference in the manifest;
- a native library whose exports contain `Java_…_load` or a JNI `RegisterNatives` table.

Record which anchor you found and where. That record is what makes the next step reproducible.

## 3. Dump at the right moment

Lazy decryption is the norm: the loader decrypts per class the first time it is used. So the
dump must happen with the app on the screen that exercises the code you care about.

- Generate the script first (`frida_dump` in `script` mode) and read it before running;
- spawn rather than attach, so the dump covers first-run decryption;
- raise the wait if the dump still looks like a skeleton, and repeat with the screen open;
- validate every recovered file: `magic == dex\n03`, `header_size == 0x70`,
  `endian_tag == 0x12345678`, plausible `file_size`.

Files that fail validation are string constants that happened to spell a header. Drop them.

## 4. Analyse the dump

Ordinary Android work from here: `search_dex_symbols` on the dump, `disassemble_dex_method` for
the one method that decides the question, `decompile_android` on a rebuilt APK only if you need
the whole tree.

## 5. State the boundary

Two statements belong in the report, always:

- what was recovered (files + class counts) and what was not;
- that the installed package was not modified, and that findings are from the dump.

If the payload is itself virtualised, stop at the recovered DEX and say so. A labelled partial
result is evidence; a reconstruction from memory of what the code "must" do is not.
