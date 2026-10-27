# Precedent — loader hijack plus IAT hook, when the edition is one masked integer

## When this package applies

- A signed native desktop product imports a **version-query module by bare name**, so a file beside
  the executable is loaded before the system copy.
- Authorisation is **offline and symmetric**: a hardware-derived key encrypts a credential blob in
  the registry, and the client decrypts it and decides locally.
- The "edition" surfaces as an integer that is decoded by a small bit-shuffle rather than compared
  against a signature — so the number is the whole entitlement.
- There is also a dialog that *displays* the licence text, and you want it to say something truthful
  instead of the built-in template.

If the product has no such import, or the code section is writable at runtime and no proxy is
needed, [proxy-dll-license-state-machine](../proxy-dll-license-state-machine/README.md) is the
simpler route. If authorisation happens online and the client decides on a bare boolean, start from
[cardkey-online-runtime-patch](../cardkey-online-runtime-patch/README.md).

## Shape of the work

1. **Read the auth chain end to end before touching anything.** Where the credential comes from
   (registry path and value names), how the session key is derived (which hardware input, which
   cipher), what the validation actually checks, and where the decoded result is dispatched. The
   chain here ends in a single store of a masked integer into one field.
2. **Decode the mask on paper.** Pull the transform out of the codec, verify it in both directions
   with known inputs, and only then treat the three store sites as equivalent. Without the inverse
   you cannot predict what a patched immediate means.
3. **Find the decision's *use*, not its storage.** Three stores write three different editions; the
   branches in front of them choose which one runs. Neutralise the branches first — that is a
   two-byte change per branch — then adjust an immediate only if you need a different edition than
   the path you unlocked.
4. **Check the hard dependency before promising anything.** This product loads a module from its own
   `data` directory and calls `ExitProcess` if that fails. Any delivery that disturbs it produces a
   modal error before your patch ever runs.
5. **Count the delivery file's jobs.** If one proxy both patches code and rewrites a dialog, log them
   separately; a partial success is the normal case and you need to know which half landed.
6. **Measure the UI, do not assume it.** Control id, window class, style and line count are runtime
   facts. The decompiler's guess about the class was wrong, and the first hook silently did nothing.
7. **Verify by reading the control back from another process.** `WM_GETTEXT` plus a line count is
   evidence; a screenshot is an impression.

## Traps that cost real time

- **Editing the string resource.** The template lives in a language file that the product may
  integrity-check, and it goes through a substitution step you would have to reimplement. Hook the
  point where the finished wide string is handed to the dialog instead — it is plain C data by then.
- **Hooking the template function.** It takes C++ string objects; reimplementing their ABI is a
  reliable way to get an access violation. Choose the boundary where the data is already a
  `wchar_t*`.
- **Trusting the class name from the decompiler.** The code says "static"; the control is an `Edit`.
  A class-name check that fails silently produces "the hook ran but nothing changed".
- **Assuming `\r\n` survives compilation.** One toolchain dropped the `\r` from the literal, leaving
  `text\n`; a multi-line `Edit` then renders one line. Verify the bytes, then verify the line count.
- **Logging non-ASCII through a narrow format string.** A `printf`-style `%ls` truncates at the
  first non-ASCII character, which reads exactly like "my code never executed". Dump UTF-16 code
  units instead.
- **Judging by screenshot.** Use line counts, control ids and byte dumps; keep screenshots for the
  report, not for the decision.

## Evidence this package expects you to produce

- the auth chain: registry values, key derivation input, cipher primitives with their RVAs, the
  validation predicate, and the dispatch of the decoded value;
- the mask transform, verified forward and inverse against three known pairs;
- the store sites (address, original ten bytes, semantics) and the branch sites that select them;
- the delivery file's load path, with proof the host imports it by bare name;
- for the dialog: the interception point, the control's runtime facts (id, class, style), and a
  cross-process read-back showing the new text and its line count;
- integrity evidence that the executable, its signature and its own `data` module were untouched.

## Reading further

- [docs/method.md](docs/method.md) — order, criteria, when to stop.
- [docs/edition-and-dialog.md](docs/edition-and-dialog.md) — crypto primitives, mask, store table,
  hook mechanics, the CRLF defect, the runtime enumeration harness.
- Document library `cases/version-dll-proxy-iat-hook/` — the full walkthrough and the pitfall log
  with the hardening recommendations.
