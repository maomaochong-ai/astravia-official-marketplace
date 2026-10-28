# Defense — a single boolean gate in native code is the defect, not the patch

This package replaces one `IsLicensed`-shaped return value and shows the whole product opening. The
finding is architectural: a native binary that stores its entitlement in one integer, read from many
callers, has no defence that a four-byte write cannot defeat.

## 1. Break the single point

The patch works because step 6 of [method.md](method.md) can prove the gate is single. Design so that
proof cannot be made:

- the entitlement is a **structure** the code verifies where it is used, not a boolean cached at
  startup;
- verification is spread across the consumers that matter (export path, rendering path, persistence
  path) so a stub in one place yields inconsistent behaviour rather than an unlock;
- the value that unlocks expensive work is produced by the server, so a locally-forced gate returns
  success and still gets nothing.

The last item is the only one that survives an attacker with a debugger. The other two raise cost and
leave evidence.

## 2. Make the check observable

A native check that runs at startup, reads one global and never reports anything is invisible from the
vendor's side. Add:

- a startup verification result sent with the first authenticated request, so a patched client is
  visible in aggregate;
- periodic re-verification (not only at start) with a server-issued challenge, so a memory patch
  applied after boot is caught by the next check;
- an integrity digest of the code region around the decision, reported and *acted on* server-side.

## 3. Do not advertise

Symbols are the first map an analyst uses. Keep export tables minimal, do not name authorisation
functions in a way that survives stripping, and remove diagnostic strings that print decision values
(`licensed: %d` is a gift). Stripping is free; leaving names is a choice.

## 4. What a reviewer should be able to check

- No exported or easily-found function returns the entitlement as a bare integer.
- The gated feature requires a server-provided artefact, verified locally with a public key.
- Re-verification happens after startup, not only at startup.
- The build is stripped and the licence strings are not present in plain text.

## 5. Verifying the fix

Apply the same stub from this package's patch table to the hardened build and run through the same
nine-step verification. Pass condition: the patched image starts, the gate reports success, and the
feature still does not work because the server-issued artefact is missing or fails verification. A
patch that still unlocks means the decision is still local.

## 6. Residual risk

Native code on a user's machine can always be patched. The defensible claim is that patching it does
not produce a working product, and that the attempt leaves a trace the vendor can act on.
