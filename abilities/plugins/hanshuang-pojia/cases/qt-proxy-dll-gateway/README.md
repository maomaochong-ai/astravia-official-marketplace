# Precedent — replacing an imported library to own the whole process

## When this package applies

- A Windows desktop application whose privilege decisions live in a **separately shipped DLL** that the
  executable imports by name through the IAT — typically a Qt5 / MSVC C++ product where `Foo.exe` imports
  a few hundred C++ symbols from `Foo_Auth.dll`.
- Privileges are decided by local predicates (`isProUser()`, `isVip()`, `checkFeatureAllow()`) with no
  signature and no server check.
- The interesting service is reached through a base URL that the client assembles from a local constant, or
  through a variable the client resolves at runtime.

This is *not* the package for a single-function gate in one monolithic binary — see
[`native-islicensed-patch`](../native-islicensed-patch/README.md) and
[`client-auth-gate`](../client-auth-gate/README.md). It is also not for IAT hooking where the host imports
a handful of APIs; the lever here is that the *entire* auth surface is one importable module.

## Shape of the work

1. **Count the imports before designing anything.** Enumerate what the host imports from the target
   library. If it is by name and complete, a forwarder proxy is viable: rename the official library,
   ship your own under the original name, and let the loader resolve every symbol into the official one.
   Record the count (the source engagement: 282 symbols, 107 gated call sites) — it is both the feasibility
   proof and the evidence that nothing was missed.
2. **Never touch the official bytes.** This is the whole point of the shape: the host executable and the
   renamed original keep their published hashes on disk. All change happens in the process, which also
   makes the revert a two-file operation instead of a backup restore.
3. **Enumerate features from the framework, not by guessing.** A Qt build carries its enum names as
   meta-object string data. Extract them and you get the authoritative feature list (14 `FeatureType`
   entries in the source engagement) before you have read a single predicate.
4. **Patch predicates at their entries, one constant each.** A predicate returning `bool` becomes
   `mov al,1; ret` (`B0 01 C3`); one returning `int` becomes `mov eax,1; ret` (`B8 01 00 00 00 C3`); an
   enum-returning status function becomes `xor eax,eax; ret` (`31 C0 C3`). Every one of these returns before
   the frame is allocated, so there is no stack-balance risk. Keep a table: address, original bytes,
   patch bytes, original symbol name, effect.
5. **Expect the linker to have merged functions.** Identical bodies get folded (ICF), so one address may
   carry two or three exported symbols. That is not a bug in your patch — it is a reason the blast radius
   is larger than the site count suggests. Document the fold explicitly.
6. **Rewrite the endpoint in memory, not on disk.** Two kinds of patch are needed: the string literal itself
   and the immediate that carries its length, plus any `lea` displacement that points at it. Changing a 21-byte
   URL to a 22-byte one means the length immediate must change too, and the displacement must be recomputed
   against the new address.
7. **Put a real server behind the rewrite, or the rewrite proves nothing.** The valuable variant is a small
   local gateway that answers the client's own protocol and translates to whatever backend you configure.
   It must also pass everything it does not understand straight through to the official host, or the client's
   account and sync paths break and you will misread the failure as a patch bug.
8. **Revert completely and prove it.** Kill the process family, restore the original under its own name,
   remove every artefact the injection created, then re-hash the official files and compare against the
   published values.

## Traps that cost real time

- **`rel32` jump overflow.** The injected DLL can sit several gigabytes away from the host's code in a 64-bit
  address space. A 5-byte `E9 rel32` truncates and lands on an unmapped page: `0xC0000005` with parameter
  `0x8` (execute). Use a 14-byte absolute jump (`FF 25 00 00 00 00` + 8-byte address) over three whole
  instructions.
- **Losing a constructor's return value.** Under the MSVC x64 convention a constructor returns `this` in
  `rax`, and a factory may hand `rax` straight to the caller. A hook declared `void` destroys it; the caller
  receives a wild pointer and the heap corrupts *later*, in another module. Return the `self` you received.
- **Dropping the third argument.** Check the factory's disassembly before writing the hook signature: a
  constructor called with `rcx`/`rdx`/`r8` whose body forwards all three to its base class will crash inside
  the constructor if your hook swallows `r8`.
- **Broken trampoline stack semantics.** A trampoline entered by `call` has an extra return address, so the
  original's shadow-space writes land in your frame. Prefer unhook → plain `call` → rehook: three steps, no
  stack reasoning required.
- **Assuming the gateway bug is the client.** A JSON builder that sets `capacity = 8` without allocating the
  backing array accepts pushes until the pointer is null then crashes; a socket that uses `SO_REUSEADDR` on
  Windows lets a zombie process keep the port and swallow requests until the client times out. Use
  `SO_EXCLUSIVEADDRUSE` and fail loudly.

## Evidence this package expects you to produce

- import count and gated call site count, with the tool that produced them;
- the feature enum extracted from framework metadata, quoted as a table;
- the patch table: address, original bytes, patched bytes, symbol, effect — including the ICF note;
- the endpoint rewrite sites (string, length immediate, displacement) and a log line showing the client
  actually talking to the local gateway;
- a local-gateway transcript with one real backend, including a pass-through request to the official host;
- the revert proof: hashes before and after, and the absence of residual files.

## Reading further

- [docs/method.md](docs/method.md) — the order of work and the decision that makes the proxy viable.
- [docs/pitfalls.md](docs/pitfalls.md) — the crash set, symptom → root cause → fix, because these four cost
  days each and the symptom is always in the wrong module.
- Document library `cases/qt-proxy-dll-gateway/` — the full walkthrough this digest came from.
