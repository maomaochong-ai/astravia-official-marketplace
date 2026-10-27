# Method — instrumenting a JVM client, and why the loader route is a separate finding

## 1. The decision is one field, and everything else reads it

Decompile the controller that the launcher instantiates. In the source engagement the entire product tier is:

```java
private Zs56 lambda$new$3() {
    return this.Zh == null ? Zs56.Zw : Zs56.Zu;   // COMMUNITY : PRO
}
```

`this.Zh` is a licence-description object; `null` means community. That single comparison feeds the brand
enum, the window title, and every feature gate downstream — which is why "unlock the paid modules" collapses
to "make sure `Zh` is non-null and describes a professional licence".

Two more seams matter, and they are the ones people miss:

- the **parse entry** that validates the licence blob (a method whose body only throws on failure);
- the **state machine** that decides which licence object to build at startup.

Patch those three, and the rest of the client behaves normally because it is the *real* code running against
a *real* object.

## 2. Construct the object; never return `null`

Replacing the state machine's return value with `new Zyeo(licence, false)` where `licence` is a constructed
`Zwaf` is the difference between "the product works" and "the product starts and then fails somewhere
unrelated". The consumers assume a description object with fields; `null` moves the crash one layer down and
costs an afternoon of misdiagnosis.

## 3. The metadata array has a shape, and it grows

The unpacker returns `Object[]` and its length is a contract with the code that reads it. In the source
engagement, a recent build read **seven** fields while the historical shape had five:

| index | meaning | consumed by |
|---|---|---|
| `[0]` | licensee name | `Zeq_.Zm()` |
| `[1]` | licence id | `Zeq_.Zf()` |
| `[2]` | expiry (millis, `Long`) | `Zeq_.Zw()` / `ZL()` |
| `[3]` | mode (`1` = desktop) | `Zeq_.ZX()` |
| `[4]` | tier string | `Zeq_.ZG()` |
| `[5]` | seat count, **numeric string** | `Integer.parseInt` |
| `[6]` | AI activation token | `Zeq_.Zv()` |

Two failure modes are encoded in that table: an array that is too short throws `ArrayIndexOutOfBounds`
inside library code with no reference to your patch, and `[5]` must be a *string that parses as an integer*,
not an `Integer` — `parseInt` receives it as a `String`.

When a version bumps, re-derive this table from the readers instead of assuming the old width.

## 4. Derived entitlements live outside the licence

The most instructive part of this case: after the gate was open and the window titled itself Professional,
creating a project threw a Guice `NullPointerException: activationToken`.

The chain is worth memorising, because it is a *pattern*:

```
AgenticAiModule (Guice AbstractModule)
  └─ provider Zgp.ZG(...)
       └─ AppAiAuth.bearer(..., supplier.get())
            supplier = @Named("ai") Zlar                     ← the token
              └─ provider Zaju: (licence != null ? licence : anon).Zq()
                   └─ Zwaf.Zq() = Zfer.Zr(licensee)
                        └─ Zfn8.Zj(name) → Preferences.get(key, null)
```

The token is **not** inside the signed licence blob. It is a `Preferences` value under a key derived from a
hash of the licensee name. Consequences:

- the licence signature covers none of it, so writing the key locally is enough;
- the token is validated for HTTP safety (non-blank, no CR/LF/NUL) before being installed as a request
  header — a sane check, aimed at header injection, which does nothing for authenticity;
- therefore a "signed licence" can still yield a forgeable derived entitlement, and the fix belongs in the
  signature, not in the preferences store.

Always ask, for every premium module: *where does its own credential come from?* If the answer is "storage
we can write", you have a second finding.

## 5. Where the agent actually gets loaded

A `-javaagent` needs to appear in the JVM's option list. There are three ways and only one is reliable:

| route | timing | verdict |
|---|---|---|
| edit `*.vmoptions` next to the app | before JVM start | works, but leaves a config artefact |
| environment variable (`JAVA_TOOL_OPTIONS`, `_JAVA_OPTIONS`) | parsed by `jli` **before** `jvm.dll` finishes importing | set from `DllMain` it is already too late — observed |
| wrap `JNI_CreateJavaVM` and grow `JavaVMInitArgs.options` | after imports, before the VM exists | deterministic, no artefact |

The wrapper route is what makes the loader chain in [loader-chain.md](loader-chain.md) work. The lesson is
general: find the moment when the configuration is still in memory and yours to edit, and hook *the caller*
of the API rather than the API.

## 6. Bytecode rewriting: pick the smallest seam, keep zero dependencies

A modern JDK ships `java.lang.classfile`. A `ClassFileTransformer` that matches on method name and descriptor
and replaces the body with `return_` (or a constructed object) is a dozen lines and no third-party jars — which
matters because an agent jar with dependencies is an agent jar you have to explain.

Match on **name plus descriptor**, not name alone: obfuscated classes reuse short names heavily, and `Zu`
exists in more than one class.

## 7. Verify with numbers, then separate the findings

Evidence that convinced a reader in the source engagement:

- `premain reached -> pid=…` — the agent loaded at all;
- the constructed licence object printed with licensee / tier / expiry;
- the JVM option count `18 -> 19`;
- IAT slot index for `GetProcAddress` with the saved original pointer;
- the jar and launcher hashes, unchanged.

Then report **two** findings, because the fixes differ:

1. **CWE-602 / CWE-321** — the tier decision is local, the verification key is embedded, and core logic is
   bytecode that can be rewritten in memory. Fix: native core with virtualisation, per-class bytecode hash
   comparison after load, refuse to start when `-javaagent`/`-agentlib`/`-Xbootclasspath` appear in the
   option list, and move entitlement to server-issued short-lived tokens.
2. **CWE-427** — the JVM's native dependencies are resolved from a user-writable directory, so code executes
   before any of the above can run. Fix: `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` or
   `LoadLibraryExW` with that flag, Authenticode verification before loading a native dependency, and an
   install directory the user cannot write to.

A hardening plan that only does (1) is defeated by (2) in about a minute, and vice versa. That asymmetry is
the reason this case exists.
