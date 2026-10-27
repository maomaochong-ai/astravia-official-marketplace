# Method — auditing a protected managed client without unpacking it on disk

No addresses, salts or sample hashes below: those belong to the target. What follows is the order that
keeps the conclusion true when the file is wrapped in a native packer and most of the managed code does
not exist until the JIT asks for it.

## 1. Classify the protection before choosing a route

Three observations decide everything:

- **Is it really managed?** Even when `IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR` is zeroed, a managed image
  inside the process still has a COR20 header somewhere in memory. If the process loads the CLR at all,
  the answer is yes and the route is "reconstruct the module", not "reverse native code".
- **Which packer shape?** A section named after a commercial packer plus a single surviving import
  (`kernel32!GetModuleHandleA`) is the classic native-wrapper shape. Record it as an observation with the
  tool and output that produced it.
- **Does the packer hook the JIT?** Read `ICorJitCompiler::compileMethod` out of the vtable and compare
  against `clrjit.dll`'s base. A pointer outside that range means the packer is already in the path —
  and, decisively, that every method body is being handed to *somebody*, which is the opening.

Write all three down before touching anything. "It looked packed" is not a finding.

## 2. Rebuild the module in memory, keep the file untouched

Parse the in-memory PE: locate COR20, walk the metadata root to `#~`, then the `MethodDef` table. Every
row is 18 bytes with the body RVA in the first four. This is ordinary metadata arithmetic and it is worth
doing properly, because everything later depends on it.

Do the work on a copy in memory or in a written scratch image you label as derived. The on-disk artefact
stays byte-identical for the whole engagement — that is both a scope rule and a verification step at the
end.

## 3. Hook the vtable the packer already hooked

```
jit  = getJit()                     // exported by clrjit.dll
vt   = [jit]                        // ICorJitCompiler vtable
slot = [vt]                         // compileMethod
```

If `slot - clrjitBase` is negative or far outside the module, the packer replaced it. Make the vtable page
writable, store your own function pointer in the same slot, and forward to the original afterwards if you
need the method to still run.

Inside the hook, `CORINFO_METHOD_INFO` gives:

| offset | field | use |
|---|---|---|
| `+0` | `ftn` | `MethodDesc*`, matches `RuntimeMethodHandle.Value` |
| `+16` | `ILCode` | the real body, **bare IL**, no header |
| `+24` | `ILCodeSize` | bytes |
| `+28` | `maxStack` | needed to rebuild the header |
| `+30` | `EHcount` | reported as 0 even when handlers exist |

The last two matter: the body arrives headerless and with exception info suppressed, so a rebuild that
trusts `EHcount` silently drops `try`/`catch`. Take `maxStack`, `localVarSigTok` and the handler clauses
from the stub still sitting in the image.

## 4. Rebuild, repoint, then decompile once

For each captured body: build a fat header (12-byte header, code size, `maxStack`, local signature token,
size of the extra section when handlers exist), write body plus extra section into a scratch region,
repoint the row's RVA, and extend the section so the scratch region is mapped. Then decompile the rebuilt
image in one pass.

The payoff is measurable: the same engagement goes from "read naked IL out of a log" to "read recovered
C# and grep it".

## 5. Reflection beats reverse-engineering for stub layers

Two layers are usually present and both are trivially collapsible:

- **String encryption.** Every business string is decrypted by a method reached through a static delegate.
  Enumerate static fields, read `Target`/`Method`, and the mapping is complete.
- **Call forwarding.** Real call targets are replaced by proxies that invoke a delegate field. Same
  enumeration, same result.

Report counts, not adjectives: how many fields, how many of them resolved, how many `ldstr` sites were
still plaintext. In the source engagement the numbers were 858 delegate fields against 35 surviving
literal strings — that ratio is the finding.

## 6. Never assume the interesting assembly is the one on disk

A core assembly loaded through `Assembly.Load(byte[])` has no file to open. Enumerate `AppDomain`
assemblies at runtime, take the one whose name does not correspond to any file, dump its image, and
decompile it separately. Skipping this step produces a confident report about the wrong module.

## 7. Read the decision, and assume a second one exists

With real code in hand, the authorisation gate is usually a single comparison over a single field — one
`public static int` that drives UI labels, purchase prompts and expiry messaging. Two rules:

- **Map every reader of that field before writing anything.** A field read by six branches is six
  chances for the state to be reasserted.
- **Look for a revalidation path.** A client that talks to a server shortly after start-up will rewrite
  local state and then exit; a forged payload can look perfect for a minute and a half. Measure with a
  clock, log every rewrite, and only then claim the bypass holds.

## 8. Verify, then state the limits

The proof has four parts: the counts from steps 3 and 5; the decision site with its one comparison; a
stability run long enough to outlast any revalidation; and a statement that the on-disk image and the
user environment block are unchanged.

Then write down what was **not** established. In the source engagement the honest limit was that
managed-layer network interception weakens revalidation but cannot fully cut it — a self-built TLS stack
over raw sockets bypasses both the default proxy and the certificate callback, and only an OS-level
name-resolution block closes every path. Saying that is what made the report trustworthy; claiming a
complete cut would have been false.

## 9. Report shape

Service-side authority first: what the server should have signed and what the client should never have
decided alone. Then key material (derived entirely from local machine facts), then integrity (no
signature, no MAC, dual storage compared against itself), then the packer that made the file look
protected while leaving the process open to inspection. Each recommendation names the layer it lives in,
so the vendor can schedule it: signing, key handling, client hardening, build hygiene.
