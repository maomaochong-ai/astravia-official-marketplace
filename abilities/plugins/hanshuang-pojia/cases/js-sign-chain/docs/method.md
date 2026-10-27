# Method — reproducing a browser signing chain

No constants, keys or sample requests appear here. They belong to the target and to your
redacted capture. This is the order of steps and the checks that keep a reproduction honest.

## 1. Capture before reading

One request that works, with its response. Without an oracle you cannot tell a wrong signature
from a wrong body, and you will spend hours on the wrong half of the problem. Redact secrets at
capture time, not later.

## 2. Find the signer from the outside in

Three entry points, cheapest first:

1. **Header name.** Search the bundle for the header key. The assignment that writes it is within
   a few lines of the function that produced it.
2. **Call site.** Breakpoint on `XMLHttpRequest.prototype.setRequestHeader` (or `fetch`) and walk
   up the stack to the layer that computes the value.
3. **Request builder.** If the bundle has a `params` → `query` serialiser, the signer usually sits
   beside it.

Webpack bundles hide names, not structure: the shape "collect params → sort → join → hash →
concatenate a constant" is recognisable even fully renamed.

## 3. Confirm you have the real chain

Log inputs and output at the signing call, then recompute by hand from those inputs. Matching
means the chain is complete. Not matching means either a second stage (HMAC over a header, a
device fingerprint) or a decoy function — a page often has both.

## 4. Reproduce in isolation

Same inputs, same output, byte for byte. Two notes worth writing down while doing it:

- the ordering rule (sorted keys, insertion order, a fixed prefix) — this is where most
  reproductions silently differ;
- which fields are covered. The covered set is the security boundary; everything outside it is
  fair game for the server and that is the finding you are looking for.

## 5. Vary exactly one thing

Change a field that is *not* in the covered set and resend. If the server accepts it, the
signature does not protect that field — state it plainly with the request and response. Do not
batch variations: with one change per request you always know which change produced the answer.

## 6. Judge the secret honestly

If the signing key ships in the bundle, it is public, and the signature is an integrity check
against casual tampering at best. Say that instead of calling it a hard-coded-secret finding —
and check separately whether a *server-held* key is what actually protects the field.
