# Pitfalls — four crashes whose symptom is always in the wrong module

Every item here produced a process crash while the code I had written looked correct. In all four cases the
crash site was one or more modules away from the actual mistake, which is why they cost days rather than
minutes. The diagnostic that made them tractable was the same each time: **numbered breakpoint logging**
(`[1]`…`[6]` through the hook) plus a minidump, then read the faulting address rather than the faulting
function name.

## 1. `rel32` jump overflow — `0xC0000005`, parameter `0x8`

**Symptom.** Opening the settings panel crashed immediately; exception parameter `0x8` means *execute* on an
inaccessible page.

**Root cause.** A 5-byte `E9 rel32` jump reaches ±2 GB. A DLL injected into a 64-bit process can sit many
gigabytes away from the host's code — the source engagement measured a 9 GB gap. The displacement truncates,
the target wraps to an address that was never executable, and the CPU faults on fetch.

```
hook body address : 0x7FF9_FE1D_1D70     (our DLL)
host target       : 0x7FF7_DA68_4C80
distance          : ~0x223B4D0EB  > 2 GB  → rel32 truncated
landed at         : 0x7FF7_FE1D_1D70      → execute violation
```

**Fix.** Use a 14-byte absolute jump and overwrite three whole instructions:

```asm
FF 25 00 00 00 00        ; jmp qword ptr [rip+0]
<8-byte absolute target>
```

Choose the overwrite length by instruction boundaries, not by byte count, so no instruction is cut in half.

## 2. Lost constructor return value — the crash arrives a second later

**Symptom.** The panel opened fine, then crashed about a second later inside the widgets library, in layout
code. Nothing at the hook site.

**Root cause.** Under the MSVC x64 convention a constructor returns `this` in `rax`, and a factory may pass
`rax` straight back to its caller as the new object pointer:

```asm
mov  ecx, 0xe0
call operator new
...
call <ctor>          ; rax = this
ret                  ; caller receives rax as the new object
```

A hook declared `void` runs other code before returning, so `rax` holds whatever the last call left there.
The caller receives a wild pointer, writes into it, and the heap is corrupted — the fault surfaces wherever
the damage is first touched.

**Fix.** The hook returns `self`: declare it as returning `void*` and hand back the pointer you received.

## 3. Dropped third argument — crash inside the constructor

**Symptom.** Breakpoint log stopped at `[2] original ctor calling...` and never reached `[3]`, i.e. the
original constructor itself faulted.

**Root cause.** The factory called the constructor with three arguments:

```asm
mov  r8,  rbx
mov  rdx, rdi
mov  rcx, rax        ; this
call <ctor>          ; ctor(this, a2, a3)
```

The constructor's first act is to forward its own `rcx`/`rdx`/`r8` to the base class. A two-argument hook
signature silently drops `r8`, and the base class receives garbage.

**Fix.** Read the factory's disassembly *before* writing the signature; use
`void* CtorHook(void* self, void* a2, void* a3)`.

## 4. Trampoline stack semantics — indistinguishable from 2 and 3

**Symptom.** Same as above; the log tells you which breakpoint you reached but not why.

**Root cause.** A trampoline is entered by `call`, so the stack carries an extra return address relative to
direct entry. The original function's shadow-space writes (`mov [rsp+0x10], rbx` style) then land inside the
hook's own frame and overwrite local variables.

**Fix.** Do not run a trampoline. Use unhook → call → rehook:

1. restore the target's original bytes;
2. `call` the original as an ordinary function — stack semantics are then correct by construction;
3. write the absolute jump back.

Three steps, no stack reasoning, and it composes with recursion better than a trampoline does.

## 5. Gateway side: a capacity field without the allocation

```c
JVal* o = jnew(JOBJ);
o->keys = calloc(8, sizeof(char*));
o->cap  = 8;
/* items was never allocated */
```

`jpush` believes there is room, writes through a null pointer, and the gateway dies on the first non-empty
object. **Fix:** allocate the backing array with the capacity, and make `jpush` refuse to write when the array
is null regardless of `cap`. A defensive null check in a container is cheaper than a minidump.

## 6. Gateway side: `SO_REUSEADDR` on Windows

**Symptom.** Requests were accepted by nobody and the client timed out; the port looked free.

**Root cause.** On Windows `SO_REUSEADDR` allows several processes to bind the same port — a zombie from an
earlier run keeps the binding and swallows connections with no listener.

**Fix.** Bind with `SO_EXCLUSIVEADDRUSE`; if the port is taken, walk forward to the next one and log which
port the gateway actually chose.

## What the fix pattern is, in one line

Every one of these was a mismatch between what I assumed the machine would do and what it does — calling
convention, page distance, stack layout, socket semantics. The habit that resolves them is cheap and
repeatable: log at every boundary of your own code, trust the faulting address over the faulting symbol, and
when the same shape of failure appears twice, change technique instead of adding a third variation.
