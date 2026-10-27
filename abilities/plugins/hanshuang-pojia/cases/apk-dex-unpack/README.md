# Packed APK source recovery — precedent

`jadx` returns a dozen classes and a `StubApp`: the code that matters is decrypted at runtime
from a native library or an asset blob and loaded as a DEX that never touches the APK on disk.

## When this precedent applies

- `decompile_android` finishes quickly, and the manifest's application class is three lines of
  forwarding;
- `search_dex_symbols` finds the package names you expect but no methods behind them;
- `classes.dex` is tiny relative to the assets, or `assets/` holds an encrypted blob;
- a `System.loadLibrary` call appears before any business class is reachable.

## Shape of the work

1. `triage_binary` the APK; note requested permissions, exported components, native libraries.
2. `search_dex_symbols` for `loadLibrary`, `Lde/`, `StubApp`, `ProxyApplication` — the loader's
   name is the thing you need next.
3. `decompile_android` (jadx) once, so you have a written record of what the shell looks like.
4. `frida_dump` in `script` mode first, to read what it will do; then `run` against a device with
   the app on the screen that triggers decryption.
5. Validate each dumped DEX header (`magic == dex\n03`, `header_size == 0x70`) before believing
   it, then decompile the dump.

## Traps

- Decompiling an empty shell and calling it "the app". That is a tooling result, not a finding.
- Dumping too early: shells decrypt lazily. Keep the triggering screen open and raise the wait.
- Treating a memory dump as complete. Compare the class count against what the shell imports.
- Editing the installed APK to "unpack" it. The loader checks itself; the dump is the artefact.

## Evidence you must be able to show

SHA-256 of the APK, SHA-256 of every dumped DEX, the dump command with its wait and delay, and
the class count you recovered versus what the loader's imports imply.
