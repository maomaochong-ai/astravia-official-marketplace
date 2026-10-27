# Precedent — reading a Themida-protected .NET client back to real IL

## When this package applies

- A managed desktop application (WPF / WinForms, .NET Framework 4.x, x64) that opens normally but
  whose assembly resists every static tool.
- Imports reduced to almost nothing, a `.themida`-style section, and `IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR`
  zeroed — a native packer wrapped around a managed image.
- Most methods decompile to a four-byte body (`nop; nop; ldnull; ret`), and `ldstr` sites hold only
  the packer's own strings.

If the target is native and encrypted throughout, this is the wrong package:
[`elf-packed-loader`](../elf-packed-loader/README.md) and
[`execryptor-vm-activation`](../execryptor-vm-activation/README.md) cover unpacking and VM stubs.

## Shape of the work

1. **Rebuild the managed image in memory, not on disk.** The real PE is inside the protected process.
   Locate the embedded COR20 header, walk the metadata tables, and treat section contents as data to be
   copied — the on-disk file stays untouched for the whole engagement.
2. **Hook the JIT the packer already hooked.** Method-body virtualization does not interpret IL itself;
   it hands the decrypted body to the CLR's JIT at compile time. The packer has already redirected
   `ICorJitCompiler::compileMethod` — its pointer is outside `clrjit.dll`. Install a second hook on the
   same vtable slot and every real body passed to you is captured.
3. **Read `CORINFO_METHOD_INFO` carefully.** `+0` is the `MethodDesc*` (matches
   `RuntimeMethodHandle.Value`), `+16` `ILCode`, `+24` `ILCodeSize`, `+28` `maxStack`, `+30` `EHcount`.
   The IL handed over is **bare** — no method header — and `EHcount` is zero even when the original body
   had exception handlers. The stub left on disk still carries `maxStack`, `localVarSigTok` and the EH
   clauses; reuse them to rebuild a valid fat header.
4. **Write the bodies back, then decompile once.** Rebuild each fat header, place it in a scratch region
   the packer reserved, repoint `MethodDef.RVA`, extend the section to cover it. One decompiler pass over
   the rebuilt image beats reading byte arrays by hand.
5. **Collapse the delegate layer by reflection.** String decryption and call forwarding are stubs over
   static delegate fields. Enumerate every static field at runtime and you get the full mapping in one
   pass; there is nothing clever to reverse in the proxy itself.
6. **Dump the assembly loaded from bytes.** When the authorisation core arrives through
   `Assembly.Load(byte[])`, static analysis of the outer module cannot see it at all. Enumerate loaded
   assemblies in-process and dump the one whose name appears nowhere on disk.
7. **Then read the decision.** With real IL in hand the gate is usually mundane: one field, one
   comparison, one branch. Do not stop at "the algorithm is recovered" — the finding is the branch.

## Traps that cost real time

- **Persisting CLR bootstrap variables.** Writing `APPDOMAIN_MANAGER_ASM` / `APPDOMAIN_MANAGER_TYPE`
  (or `COR_PROFILER*`) into the user environment forces *every* later .NET process to load your assembly.
  Where it is absent, CLR start-up fails with `TypeLoadException` / `HRESULT 80131522` and the window
  flashes shut. Measured blast radius on a real desktop: dozens of unrelated processes. Keep injection
  process-level, and guard it with a target-name check.
- **Assuming a disk patch survives.** On a packed image the interesting code has `rawsize = 0`; anything
  written to the file is replaced at load time.
- **Believing a forged payload is the whole story.** A client that revalidates against a server will
  rewrite what you wrote and then exit. Measure for minutes, not seconds — the failure arrives late and
  looks like a crash.
- **Trusting the "permanent" threshold.** A magic day count (80 years, 29200) is a UI convention, not a
  security boundary; pin the field only after you know every branch that reads it.
- **Treating managed-layer network interception as a complete cut.** A default-proxy hook misses explicit
  proxies; a certificate callback misses a self-built TLS stack over raw sockets. Only name resolution
  (hosts / DNS) closes all paths, and that is an OS-level change.

## Evidence this package expects you to produce

- the loader facts that justified in-memory reconstruction (section rights, zeroed COM descriptor,
  import count), with the command and output;
- the hook site and proof the packer's own hook was already there (pointer outside `clrjit.dll`);
- counts, not adjectives: how many `MethodDef` rows, how many were stubs, how many real bodies were
  intercepted, how many delegate fields resolved;
- the rebuilt-image path, and one decompiled function quoted as the before/after pair;
- the decision site: field, comparison, branch, and the observable UI difference it produces;
- a stability measurement long enough to outlast the server revalidation.

## Reading further

- [docs/method.md](docs/method.md) — order of work, and what each step must leave behind.
- [docs/protection-layers.md](docs/protection-layers.md) — the four layers, what each one actually
  protects, and which single observation defeats it.
- Document library `cases/themida-dotnet-delegate-recovery/` — the full walkthrough this digest came from.
