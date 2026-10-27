# Method — auditing a client-side entitlement gate

No offsets, keys or sample hashes here: those belong to your target. What follows is the order
that keeps the conclusion true, and the two questions that decide the severity.

## 1. Find the decision, not the vocabulary

Searching for `license`/`vip`/`pro` produces candidates; the decision is the function whose
return value gates the feature. Three shapes cover almost everything:

- **boolean field**: `isPro` read at render time, set once at startup;
- **validated artefact**: receipt, key or signature checked locally, result cached;
- **time-based**: expiry compared against the device clock.

Read callers before reading the body. A check with no caller that gates anything is dead code
and not a finding.

## 2. Confirm the branch is the one that matters

Observe first when the static picture is ambiguous. An observe-mode hook on the candidate with a
backtrace answers three questions at once: is it called, from where, and with what inputs. Do
this before writing any patch — a patch on the wrong branch looks like progress and teaches you
nothing.

## 3. Prove effect, then stop

The proof is a pair of runs with the same input: unmodified build shows the gate closed, modified
build shows the gated capability working. Anything short of that pair is a hypothesis.

Static patch and runtime override are both acceptable; the artefact must name the exact site
(function + offset, or class + method + instruction) so it can be replayed.

## 4. The two questions that set severity

1. **Does the server re-check?** If the entitlement is re-validated per request, the client
   branch is cosmetic: the finding is "UI trusts a local flag", severity low. Say that. It is
   still a real defect — it just isn't an entitlement bypass.
2. **Does the client state travel?** If a request carries `is_pro` / `plan` / `credits` straight
   from the client and the server accepts it, that is BFLA and it is the higher-severity finding.
   Prove it with the request, not with the binary.

## 5. Write the finding so it can be fixed

Three parts, in this order: the decision point (where), the reason it is wrong (the server has to
be the authority, or the flag must be signed), and the minimal fix (server-side verification,
signed receipt, or a server-issued token the client cannot mint). A patch table alone is a
demonstration, not a report.

## 6. What not to do

- Do not record real keys, tokens or receipts in the case. Hash or redact them.
- Do not exercise a live endpoint outside the recorded scope, even to "confirm quickly".
- Do not present a runtime override as a shipped bypass; it demonstrates reachability, and the
  report should say so in those words.
