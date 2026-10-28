# Defense — designing so a patch table does not survive the next build

This package is about the *patchability* of a decision, and the defensive reading is uncomfortable
for anyone who ships byte-level protection: a table of addresses that must be re-derived for every
build is a table of seams. The vendor-side question is not "how do I make the offsets move?" but
"why is there a single instruction whose constant decides the product?"

## 1. Remove the single constant

The tool works because one comparison, one immediate, or one conditional jump encodes the answer. Any
protection that leaves such a site in place is defeatable by whoever finds it first, and finding it is
a signature problem — which [method.md](method.md) shows is a solved one across builds.

What replaces it:

- the decision arrives **as data**, not as a branch: a signed entitlement the client verifies;
- verification is a whole-function property (a hash over a region, a certificate chain check) rather
  than a single `cmp`;
- the gated capability itself needs a value the client cannot compute locally — a server-issued key
  fragment, a decryption key released on a successful call.

## 2. Keep the anti-drift machinery, drop the illusion

Checksums, page hashes and self-verification do not stop a patch; they make a patch *detectable*.
That is still worth building, provided it is wired to something that acts on the signal:

- a failed self-check should invalidate the session, not show a dialog;
- the server should be told, so one patched install becomes one revoked session instead of an
  offline curiosity;
- the check must run after the code is decrypted and paged in, otherwise the patch window is before
  the check.

## 3. If you must keep a build-specific table, treat it as a liability

Internal tooling that patches a shipped binary (hotfixes, telemetry stubs) faces the same structural
problem in reverse: a table that only works on one build will one day be applied to the wrong one.
The rule that keeps it safe is the one this package's method states — verify size, checksum, image
end and section table before writing, refuse on any mismatch, and log the refusal. Never "try the
nearest match".

## 4. What a reviewer should be able to check

- No single instruction in the gated path decides entitlement on its own.
- The gated feature consumes a value that only the server can produce.
- Self-verification results reach the server and change authorisation state.
- Symbol and section names do not advertise the decision (`IsLicensed`, `CheckTrial`, `g_pro`).

## 5. Verifying the fix

Take the published patch table for the previous build and try to replay it against the new one. A
build is in good shape when every site either fails its pre-write checks or, having been patched
successfully, leaves the feature non-functional because the required value never arrived. The second
outcome is the one to aim for; the first only means the tool was unlucky.

## 6. Residual risk

A determined attacker with one build and unlimited time will always find the branch that decides
something locally. The design goal is that finding it grants nothing durable: no minted entitlement,
no reusable token, and a server-side record of the attempt.
