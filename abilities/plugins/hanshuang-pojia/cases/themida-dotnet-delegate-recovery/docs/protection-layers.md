# Protection layers — what each one protects, and the one observation that defeats it

This package's case is a stack of four layers over one ordinary managed module. Read them in order: each
one is a real technique, and each one has an assumption that a running process breaks.

## Layer 1 — native packer around a managed image

**Technique.** A commercial native packer (`themida`-family) wraps the assembly: its own sections appear,
the import table is stripped to one or two API calls, and `IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR` is zeroed
so managed-aware tools refuse to open the file.

**What it actually protects.** The on-disk shape. Nothing else. At runtime the packer must build the
managed module and hand it to the CLR, because that is the product's only execution path.

**The observation.** A process that runs managed code has a COR20 header in memory, whatever the file says.
Reconstruct from the process, not from the file.

**Cost of getting it wrong.** Patching the file: the interesting sections have `rawsize = 0`, so a disk
patch edits bytes that no longer exist after load.

## Layer 2 — method-body virtualization (stubbing)

**Technique.** Thousands of `MethodDef` rows have their bodies replaced with a four-byte stub
(`nop; nop; ldnull; ret`). The real IL is produced by a native component at compile time and handed to the
JIT, so a static decompiler sees an application that does nothing.

**What it actually protects.** Everything that reads method bodies out of the file. Which is every static
decompiler, and no JIT.

**The observation.** The packer cannot avoid the CLR's JIT interface: it either becomes `compileMethod` or
replaces it. Either way there is exactly one chokepoint, and the vtable slot is writable.

**Signal that the packer is already there:** `compileMethod` resolves to an address outside `clrjit.dll`.
Take that as confirmation, install your hook in the same slot, and forward the call afterwards.

**Detail that costs a day if missed:** the `ILCode` passed in is bare — no method header — and `EHcount`
reads 0 even for methods that had handlers. The fat-header fields you need (`maxStack`, `localVarSigTok`,
clause count) are still present in the on-disk stub; harvest them there instead of inventing defaults.

## Layer 3 — string encryption plus delegate trampolines

**Technique.** All business `ldstr` sites are rewritten to route through a decryptor reached via a static
delegate field; direct calls are replaced by proxies that invoke a delegate. Reading the proxies by hand is
pointless: they are uniform.

**What it actually protects.** The prose of the application — labels, messages, format strings, and the
names of the things worth looking at.

**The observation.** A delegate field is still a field. Enumerate static fields at runtime, read each
`Delegate.Target`/`Method`, and the whole mapping arrives at once. Counts are the evidence: in the source
engagement 858 fields resolved, against 35 strings that had never been encrypted (all belonging to the
packer itself).

**Why the count matters.** "We decrypted the strings" is not checkable. "9632 bodies intercepted, 858
delegate fields resolved, 1163 files decompiled" is.

## Layer 4 — authorisation core loaded from bytes

**Technique.** The interesting assembly is not a file. It is decrypted out of a resource and loaded with
`Assembly.Load(byte[])`, under a name that appears nowhere on disk.

**What it actually protects.** The algorithm, from anyone who only statically analyses the modules they can
see. It is the layer most often overlooked, and the one that produces wrong reports: you can do excellent
work on the outer module and never once see the code that decides whether the user has paid.

**The observation.** Enumerate `AppDomain.CurrentDomain.GetAssemblies()` in-process; the intruder is the
assembly whose location is empty or whose name matches no file. Dump its image bytes and decompile it as
its own artefact.

## After the four layers

What is left is unremarkable: a machine code derived from local hardware facts plus a hard-coded salt, a
symmetric cipher whose key and IV are both sliced out of that machine code, a payload with no signature and
no MAC, two storage locations compared against each other, and a single `public static int` driving every
entitlement branch.

That last one is the finding. Every layer above it was expensive to build and none of them touch the
decision: the client decides, alone, from data it can derive itself.

## Design rules this case leaves behind

- **Do not persist CLR bootstrap variables.** `APPDOMAIN_MANAGER_*` / `COR_PROFILER*` in the user
  environment hijack *every* later .NET process on the machine; where the assembly is not present they die
  at start-up with `TypeLoadException` (`HRESULT 80131522`). Injection is process-level or not at all, and
  it should refuse to run unless the main module is the target.
- **Never derive a key only from client-side facts.** Machine code is an identifier, not a secret; it
  belongs inside a signature, not inside key derivation.
- **A payload without a signature is a payload without an owner.** Sign with a server-held key, verify with
  an embedded public key, and treat everything else as display cache.
- **A single field must not be the whole authority.** If one integer decides entitlement, one write decides
  it too.
- **Plan for revalidation when you audit timing.** A client that rechecks will erase a forged state; only a
  measurement that outlasts the recheck proves anything.
