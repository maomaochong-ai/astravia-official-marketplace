# Client-side entitlement gate — precedent

A paid feature that unlocks on a boolean the client computes: `isPro`, a locally verified
receipt, a card key checked against a hard-coded table, an expiry date compared on the device.
The decision is client-side, and the server accepts the client's word for it (CWE-602).

## When this precedent applies

- the "premium" surface renders from a boolean or an enum, and the check is in the same binary
  as the feature;
- a signature, receipt or key is validated by the client, not by an endpoint that returns a
  server-signed result;
- the expiry/entitlement state is stored in local storage, prefs, or a plain file;
- a request that carries an entitlement flag straight from the client is accepted (BFLA).

## Shape of the work

1. Locate the gate: `search_dex_symbols` / `list_code_symbols` for `license`, `vip`, `pro`,
   `subscri`, `purchase`, `activation`, `expiry`.
2. Read the deciding function before touching anything: `disassemble_dex_method` or
   `decompile_function`. You want the branch condition, its inputs, and its callers.
3. Observe it when the shape is unclear: `generate_hook` in `observe` mode, with a backtrace, to
   see what actually reaches the decision in a real session.
4. Prove reachability and effect — a patch or an override that flips the branch, plus the
   evidence that the gated feature then runs.
5. Check the server side separately: is the flag re-validated? If yes, the finding is a UI
   inconsistency, not an entitlement bypass. Say which one you found.

## Traps

- Listing strings and calling it a bypass. A string is not a reachable branch.
- Patching before observing. You will patch the wrong of three checks and believe the fourth.
- Ignoring the server. If the entitlement is re-verified server-side, the client branch is
  cosmetic and the severity is low — that is still a finding, stated honestly.
- Reporting the patch as the deliverable. The deliverable is the reachable decision point.

## Evidence you must be able to show

The decision point (symbol + offset, or class + method + smali line), the condition before and
after, and a run that shows the gated feature working or the server accepting the client's
claim. Plus the same run against the unmodified build.
