# Loader chain — nine steps from a written file to a rewritten JVM

This document is the mechanics of the second route: no configuration, no shortcut, one added DLL. It is also
the argument for why the obvious shortcut (an environment variable) does not work.

## Step 0 — the search order that makes it possible

- `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\SafeDllSearchMode` **unset** → default enabled:
  ① application directory → ② System32 → ③ Windows directory → ④ current directory → ⑤ `PATH`.
- The bundled JRE never calls `SetDefaultDllDirectories()` / `SetDllDirectory()` / `AddDllDirectory()`,
  confirmed from both the import table and the strings.
- The candidate DLL is **not** registered in `KnownDLLs`, so Windows does not force System32.

Together: a DLL placed in the application directory wins over System32, and it is loaded when the JVM's own
native module is mapped — before `JNI_CreateJavaVM` runs.

## Step 1 — pick the host module, not the launcher

The launcher in the source engagement is an install4j stub importing four DLLs, all KnownDLLs — nothing to
hijack there. The interesting module is the JVM's own `jvm.dll`:

| module | imports | in KnownDLLs | hijackable |
|---|---|---|---|
| launcher `.exe` | `kernel32`, `user32`, `advapi32`, `ole32` | all | no |
| `jre\bin\server\jvm.dll` | `VERSION.dll` | **no** | **yes** |
| `jre\bin\server\jvm.dll` | `WINMM.dll` | no | yes |
| `jre\bin\server\jvm.dll` | `POWRPROF.dll` | no | yes |
| `jre\bin\server\jvm.dll` | `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll` | no | yes |
| `jre\bin\server\jvm.dll` | `WS2_32.dll` | yes | no |
| `jre\bin\java.dll` | `VERSION.dll` (`GetFileVersionInfoW`, `VerQueryValueW`, `GetFileVersionInfoSizeW`) | no | yes |

Prefer the one the *JVM* imports: it loads earlier than anything the app does and it loads regardless of how
the launcher is invoked.

## Step 2 — forward every export, or the host dies first

The precise imports in the source engagement:

```
jvm.dll  → VERSION.dll : GetFileVersionInfoA, VerQueryValueA, GetFileVersionInfoSizeA
java.dll → VERSION.dll : GetFileVersionInfoW, VerQueryValueW, GetFileVersionInfoSizeW
```

17 real exports exist (A/W pairs plus `…Size` variants). Generate the export table from the genuine DLL —
hand-writing it produces a proxy that is missing one `…Size` variant, and the failure is an
entry-point-not-found dialog at JVM start with no Java log whatsoever.

## Step 3 — `DllMain` runs before the VM exists

`DLL_PROCESS_ATTACH` fires when `jvm.dll` is mapped, which is before the launcher asks for
`JNI_CreateJavaVM`. At that point you have:

- a mapped main module with a readable PE header;
- writable own data;
- the full Win32 API, including `VirtualProtect`.

No Java runtime yet — so nothing you do here produces a Java stack trace, which is why this route leaves no
JVM-visible trace.

## Step 4 — find the IAT slot for `GetProcAddress`

Walk the import descriptors of the host module, find `KERNEL32.dll`, then walk `OriginalFirstThunk` (the
name table) to get the index of `GetProcAddress`, and rewrite the corresponding `FirstThunk` (the address
table) slot:

```
descriptor → NameTable[i] == "GetProcAddress"  →  index 27
IAT[index] = &my_get_proc_address              ; save the original first
```

Two rules: **save the original pointer** (every non-targeted resolution must forward to it), and change the
page to `PAGE_READWRITE` for the duration of the write, restoring the previous protection afterwards.

## Step 5 — the launcher resolves the VM entry by name

```
GetProcAddress(jvm, "JNI_CreateJavaVM")  →  my_get_proc_address  →  my_create_java_vm
```

Because the launcher looks the symbol up at runtime rather than importing it, hooking the *resolver* catches
it regardless of the module layout. Hooking `JNI_CreateJavaVM` by hard-coded address inside a freshly mapped
image works too but needs a signature scan per build; the resolver does not.

## Step 6 — edit `JavaVMInitArgs` while it is still yours

```
args.options: 18 entries  →  realloc 19  →  append "-javaagent:<abs path>\LoaderAgent.jar"
args.nOptions: 18 → 19
```

Log both numbers. `nOptions` before and after is the one-line proof that the injection happened and that the
option array was resized correctly; a wrong pointer here produces a VM that starts and silently ignores the
agent.

## Step 7 — the real `JNI_CreateJavaVM` does the rest

Forward to the saved original with the modified args. `jli` parses the option list, loads the agent jar,
calls `premain`, and normal startup continues. The agent then instruments the three seams described in
[method.md](method.md).

## Step 8 — why `JAVA_TOOL_OPTIONS` is not an alternative

`JAVA_TOOL_OPTIONS` / `_JAVA_OPTIONS` are consumed by `jli` during VM bootstrap, which happens **after**
`jvm.dll`'s imports have been resolved and after `JNI_CreateJavaVM` was already entered. Setting the variable
from `DllMain` was tried in the source engagement and the VM did not pick it up — a timing fact, not a
configuration mistake. The wrapper route is decoupled from that timing by construction, which is exactly why
it works.

## Step 9 — what the chain gives you, and what it does not

Demonstrated in the source engagement:

| capability | status |
|---|---|
| native code execution before the VM exists | observed |
| JVM option injection (`-javaagent`, `-Xbootclasspath`, `-D…`) | observed |
| agent loaded and gate rewritten | observed |
| host and jar files byte-identical afterwards | observed |
| no config file touched | observed |
| arbitrary API hooking (`Crypt*`, `WinHTTP`, `WS2_32`) | demonstrated on `GetProcAddress` only |
| persistence, traffic interception | feasible, out of scope |

The reportable claim is the first five. Anything in the last two rows should be written as "reachable, not
demonstrated" — the difference between a finding and a story.

## Reversibility

The change is: one file added to the install directory. Revert = delete it. Prove it by recording the file
list and the hashes of the launcher, the jar and the JRE's `version.dll` before and after. Because nothing
else was touched, this route has the cleanest rollback of any case in this library — and that is worth saying
explicitly in the report, because it is also why a reviewer can safely reproduce it.
