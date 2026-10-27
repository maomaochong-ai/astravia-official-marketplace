# Patch discipline — cardkey-online-runtime-patch

The addresses below are the teaching values from the archived case (`0x00400000` base, no ASLR).
On your target, locate them again with the AOB anchors rather than reusing the offsets.

## The sites

| # | address | original bytes | patched bytes | effect |
|---|---------|----------------|---------------|--------|
| P1 | `0x00401290` | `83 7D FC 00 0F 84 4D 02 00 00` | `C7 45 FC 01 00 00 00 90 90 90` | `cmp [ebp-4],0` + `je fail` → `mov dword [ebp-4],1` + `nop×3`: the local verdict is forced to "pass" |
| P2 | `0x0041AC81` | `0F 8D 34 01 00 00` | `E9 35 01 00 00 90` | `jge <next check>` → `jmp`: first recheck verdict neutralised |
| P3 | `0x0041AE05` | `0F 8D 34 01 00 00` | `E9 35 01 00 00 90` | same shape, second recheck verdict |

Total: 3 sites, 22 bytes. Two of them share identical original bytes — anchor them with the
surrounding instructions, never with the six bytes alone.

## Locating them after a rebuild

| # | anchor | note |
|---|--------|------|
| P1 | `83 7D FC 00 0F 84 4D 02 00 00` | unique in the section |
| P2 | `89 65 F8 68 00 00 00 00 68 FF FF FF FF B8 02 00 00 00` then the jump before it | prefix anchor required |
| P3 | `83 C4 04 83 7D F4 01 0F 8D 34 01 00 00` | includes the preceding `add esp,4` and `cmp` |

## Timing

The code section has `rawsize = 0` on disk: the bytes you want do not exist in the file, so a
file patch is written into nothing and replaced at load. Patch after decryption instead, and
synchronise on a byte predicate rather than a sleep:

```
start the process
poll ReadProcessMemory(0x0041AB86, 3) every 20 ms
until it reads 55 8B EC          ; push ebp; mov ebp, esp — the section is decrypted
write P1, P2, P3 (VirtualProtectEx first if the section is not already writable)
read every site back and compare
```

## Control matrix — run this before trusting any site

| variant | patch | outcome | lesson |
|---------|-------|---------|--------|
| baseline | none | any key → "card key does not exist" | reference |
| A | P1 only | main window fails to create, process exits within ~5 s | the recheck can terminate the client |
| B | P1 + `ret` at the recheck function entry | window opens, access violation after ~17 s | skipping a whole function skips its initialisation; the crash is delayed and looks unrelated |
| C | P1 + recheck helper returns a constant | exits within ~5 s | the helper's return type is a byte set; forcing an integer breaks the caller's conversion |
| F | P1 + P2 + P3 | window opens, any key accepted, stable ≥ 320 s of use | the minimum stable set is the conditional jumps |

Two rules follow and both are general:

1. **Change the conditional jump.** `jge` → `jmp` is a local decision edit; the surrounding
   state stays coherent.
2. **Never force a return value, never `ret` a whole function.** Typed runtimes and initialisers
   make both fail late and confusingly.

## Process hygiene

- A GUI child started from a batch or script inherits the console. When the console closes the
  child receives `CTRL_CLOSE_EVENT` and dies mid-verification — create it detached
  (`CREATE_DETACHED_PROCESS`, `0x00000008`).
- Read back every patched site; a write that silently failed is indistinguishable from a patch
  that did not help.
- Hash the image before and after. Keeping the file byte-identical is part of the evidence, not a
  nicety: it proves the patch existed only in memory.
- Run long enough to outlast the recheck (minutes, not seconds), and exercise the gated feature
  while it runs.
