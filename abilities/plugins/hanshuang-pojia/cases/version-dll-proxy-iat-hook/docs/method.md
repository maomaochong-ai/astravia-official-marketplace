# Method — from an encrypted credential to one masked integer, then to the dialog

Addresses stay in [edition-and-dialog.md](edition-and-dialog.md). This is the order, the criteria,
and the two places where a plausible answer is the wrong one.

## 1. Follow the chain to its last write

Offline authorisation looks intimidating and is usually shallow: a blob in the registry, a key
derived from hardware, a symmetric cipher, a predicate, and then a value that gets stored somewhere.

Read it in that direction and write each hop down:

- **source** — registry hive and value names, and which of them must be non-empty;
- **key** — what the session key is derived from (a hardware identifier, a volume serial, a hash of
  both) and how it is encoded;
- **cipher** — the primitives, identified by their key schedule rather than by guessing from the
  size of the loop;
- **predicate** — what the decrypted fields are actually compared against; there is usually one
  equality check that carries all the weight;
- **dispatch** — where the decoded value goes, and what each consumer means.

The last hop is the finding. Everything before it explains *why* the value is trusted; the last hop
explains *what to change*.

## 2. Prove the encoding before you trust the equivalence

The stored edition is not the edition. It is a bit-shuffled integer, and the decoder is a handful of
shifts and masks. Extract it, then verify in both directions against at least three known pairs —
one per edition. Only after that are the three store sites interchangeable, and only after that can
you say what a patched immediate means.

Doing this in the wrong order is how people "patch Enterprise" and get Standard, or get an edition
value that no consumer recognises, which presents as a feature that silently does nothing.

## 3. Branch first, immediate second

The three stores sit behind three branches. Neutralising the branches is the smaller, safer edit:
each is a two-byte conditional jump turned into a no-op, and the result is one specific edition
reaching the decoder.

Changing the immediate instead is legitimate, but it is the second move, not the first: it requires
you to have done step 2, and it leaves the branch structure intact so that a future build can change
which branch is taken without touching your patched immediate.

Both edits are **complete instructions**. The stores are ten-byte `mov dword [reg+disp], imm32`; a
partial overwrite of the immediate is fine, a partial overwrite of the opcode is not.

## 4. Find what the product cannot live without

Before designing a delivery, look for the fatal dependency: a module the product loads from its own
directory and treats as mandatory, with a message box and a process exit on failure. If you disturb
it — rename it, shadow its directory, change its search path — you get a modal error and no patch.

Verify afterwards that the module loads from where it should, and that your delivery file is the one
the host picked up. "The feature worked" is not that proof; the loaded-module list is.

## 5. Choose the boundary where the data is already plain

For rewriting displayed text there are three candidate boundaries, in increasing order of safety:

1. **the resource / language file** — may be integrity-checked, and needs the substitution engine
   reimplemented;
2. **the template function** — takes C++ string objects; you would be reimplementing their ABI, and
   the failure mode is an access violation;
3. **the call that hands the finished wide string to the control** — plain `wchar_t*`, one import to
   hook, no ABI at all.

Take the third. It is also the one that survives a change of template, because you are no longer
depending on the template's content.

## 6. Measure the control; do not model it

The decompiler will tell you the control id and, if you are unlucky, imply a class. Both need
checking at runtime: id, class name, style bits, size, and — for a multi-line control — how many
lines it currently has.

This is not pedantry. A class-name check that assumes "static" while the control is an `edit` makes
the hook return early and produce no visible change, which reads exactly like "my patch did not
work". Log the miss.

## 7. Verify the text the way the widget sees it

Two checks, both cheap:

- read the control's text back from another process and dump it as UTF-16 code units — a
  `printf`-style wide conversion truncates on the first non-ASCII character and will convince you
  nothing happened;
- ask the control how many lines it has. A multi-line edit that reports one line means the line
  breaks were not what you think they were.

Then, and only then, take the screenshot for the report.

## 8. Put the variable parts in a file

Anything a user might want to change — the control id, the replacement text, whether to rewrite at
all — belongs in an ini next to the module, with escapes for newlines and tabs, BOM tolerance and a
built-in default when the file is absent. This turned a recompile-per-tweak loop into an edit.

The absence path must be a first-class case: log it and use the default, do not fail.

## 9. Close on the two weak seams

The report writes itself once the chain is on paper:

- **the edition is a client-held integer**, decoded locally, with no signature binding it to a
  purchase — client-side authority, CWE-602;
- **the loader resolves a module by bare name from the program directory**, so a file the vendor did
  not ship can run inside a signed process — the display rewrite is a symptom of that, not a separate
  bug.

The fixes are correspondingly architectural: sign the entitlement (short-lived, server-issued),
verify it where it is used instead of caching a decoded integer; and resolve modules from the system
directory with a signature check, or set the process-wide search policy before loading anything.
