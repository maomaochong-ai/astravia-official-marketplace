# Precedent — a JVM client whose entitlement is one null check, reachable two ways

## When this package applies

- A paid desktop product shipped as a **single monolithic JAR** on a bundled JRE, with a native launcher
  (install4j or similar) that exists only to find the JRE and call `JNI_CreateJavaVM`.
- The premium/standard decision is a **local** one: a field on a controller object, a brand enum, a state
  machine that returns "community" or "professional" from what it manages to parse.
- All of the paid code is **already inside the jar** and runs offline.

Two very different levers exist for such a target, and the point of this package is that they are different
findings with different fixes:

| lever | change on disk | who can do it | fix lives in |
|---|---|---|---|
| `-javaagent` bytecode rewriting | nothing | anyone who can edit a launch config | client integrity checks + native core |
| DLL search-order hijack → agent | one added DLL | anyone who can write the install dir | loader hardening + directory ACLs |

If the product is not JVM-based, this is the wrong package. For a native single-function gate see
[`native-islicensed-patch`](../native-islicensed-patch/README.md); for a .NET delegate/VM stack see
[`themida-dotnet-delegate-recovery`](../themida-dotnet-delegate-recovery/README.md).

## Shape of the work

1. **Read the decision, not the UI.** Decompile the controller and the brand enum. The finding is almost
   always one comparison — in the source engagement, `this.Zh == null ? COMMUNITY : PRO`, where `this.Zh`
   is a licence-description object. Enumerate every method that reads it, because the state machine that
   *creates* it is the upstream of the same decision.
2. **Rewrite at the three seams, not at every call site.** Instrumenting each gated feature is a hundred
   patches; instrumenting (a) the parse entry, (b) the metadata unpacker, (c) the state machine gives you
   the whole product with three. Any bytecode library works — a modern JDK's own `java.lang.classfile`
   keeps the agent dependency-free.
3. **Return a real object, not `null`.** Replacing the state machine's return with a constructed
   licence-description instance is what makes the *rest* of the client work; returning `null` moves the
   crash one layer down, into whatever code assumed a non-null description.
4. **Watch for the second, derived token.** Paid builds often derive extra entitlements from the licence
   through a *different* path — a preferences entry, a cached header, a supplier registered with the DI
   container. In the source engagement the AI module required an activation token read from
   `Preferences` under a key that is a **hash of the licensee name**, with no binding to the licence
   signature. Expect this class of failure: entitlement succeeds, then a module-level provider throws
   `NullPointerException` on a field you never saw.
5. **Map the loader before you use it.** If you want the no-configuration route, enumerate the imports of
   every native module in the bundle and check each name against the KnownDLLs list. What matters is not
   "a DLL is missing" but "a DLL the JVM itself imports, not in KnownDLLs, resolved from a user-writable
   directory". In the source engagement the launcher imported only KnownDLLs, while `jvm.dll` imported
   `VERSION.dll`, `WINMM.dll`, `POWRPROF.dll` and two VC runtimes.
6. **Forward every export of the DLL you shadow.** A hijacked `VERSION.dll` must be a working `VERSION.dll`
   or the host dies before your payload runs. 17 exports in the source engagement (A/W pairs plus `…Size`
   variants); generate the forwarder table from the real DLL, do not hand-write it.
7. **Hook `GetProcAddress`, not `JNI_CreateJavaVM` by address.** The launcher resolves the JVM entry by
   name at runtime. Rewriting the IAT slot for `GetProcAddress` and returning a wrapper means you sit at
   the exact point where the option list is still yours to edit.
8. **Inject through `JavaVMInitArgs`, and prove it.** Grow the options array by one and append
   `-javaagent:<abs path>`. Environment variables do not work here: `JAVA_TOOL_OPTIONS` is consumed before
   `jvm.dll` finishes importing, so a `DllMain` set is already too late. Log the option count before and
   after — that number is the evidence.

## Traps that cost real time

- **The jar hash proves nothing.** Both routes leave the jar byte-identical. Saying "the jar was not
  modified" is a statement about your method, not about integrity; the missing check is the finding.
- **`null` instead of an object.** See step 3. The symptom appears as a DI provider failure far from the
  gate.
- **Second-order entitlements.** See step 4. Look for `Preferences`, `Supplier` providers, "AI token",
  "seat count" fields; they are frequently read from storage that the client itself can write.
- **The launcher's own imports are the wrong place to look.** The interesting imports belong to the JVM's
  native layer, deep inside the bundle.
- **Forwarding by hand.** A partially forwarded proxy DLL crashes the host at JVM start with an
  entry-point-not-found dialog and no Java log at all.
- **Assuming the agent needs configuration.** Under the DLL route there is no config file to edit, so no
  "did the user add the flag?" support question ever arises.

## Evidence this package expects you to produce

- the decision site: class, method, decompiled branch, and what the field means;
- the three instrumented methods with their descriptors, and the log line proving `premain` ran;
- the entitlement object actually constructed (licensee, tier, expiry), read back at runtime;
- for the loader route: the import table that justifies the choice of DLL, the export count forwarded, the
  IAT slot index and the saved original pointer, and the JVM option count before/after;
- both files' hashes unchanged;
- the second-order token path, if the product has one, with the key derivation described.

## Reading further

- [docs/method.md](docs/method.md) — the decision model and the order of work.
- [docs/loader-chain.md](docs/loader-chain.md) — the nine-step loader chain, with the timing argument for
  why the environment-variable shortcut fails.
- Document library `cases/java-agent-dll-hijack/` — the full walkthrough this digest came from.
