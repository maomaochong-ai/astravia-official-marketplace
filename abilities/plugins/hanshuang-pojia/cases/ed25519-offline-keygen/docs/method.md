# Method — auditing an offline activation code and its embedded key

No key material and no addresses here; those live in [algorithm.md](algorithm.md) as teaching
values. This is the order that turns "there is an activation code box" into "here is a key pair the
client trusts and a code it accepts".

## 1. Start from the UI strings, end at the verifier

An activation dialog is a thin shell. The useful anchors are the strings only that path uses:
the widget name of the code field, the dialog class name, the request names on the network side.
Cross-reference them and you get a small set of functions — the format checker, the decoder, the
verifier wrapper, and the state check.

Read them in that order. It matches the order the client executes, so each step's output is the
next step's input, and a failure is localised immediately.

## 2. Establish the container before touching the crypto

An activation code is a container: a version character, a check character, a separator, and a body.
Every one of those is testable without any cryptography:

- does the length have to exceed a minimum, and is the separator at a fixed index?
- is the check character derived from the rest (a sum of adjacent differences is a common choice)?
  Verify by computing it for a known-valid code.
- does the body decode as standard base64, and does the decoded length exceed the signature length?
- does the decoded body start with 64 bytes that look random, followed by something compressed?

Getting this right is what makes the rest tractable: once you can produce a code that passes the
format checks, you only have to solve the signature.

## 3. Identify the algorithm and the exact message

Look at the verifier: if the symbol contains a well-known scheme name (an Ed25519 verifier from a
crypto library, a BCrypt import, a JOSE library), the scheme is settled. Then find **what** is
passed as the message.

Sign what the client verifies, not what you think it should verify. In the archived case the body
is XORed with the signature, decompressed, and XORed again — and the verifier XORs a third time, so
the net message is exactly the JSON plaintext. A format like that makes the audit easy *and* is a
design mistake worth reporting: the signature covers the plaintext, so there is no domain
separation and no digest to argue about.

Confirm the message by capturing the verifier's arguments at runtime. Do not infer it from the
call graph.

## 4. Answer one question about the key: where does it come from?

Three possible answers, three completely different conclusions:

| key source | consequence |
|------------|-------------|
| server, per session | client-side forgery is closed; the finding is elsewhere |
| compiled in as plaintext bytes | trivial replacement |
| compiled in as **encrypted** bytes, decrypted at runtime | replacement with one extra step: recover the transform |

The third case is the interesting one, and it is common: developers treat the public key as a
secret, encrypt it, and thereby convert "a constant anyone can read" into "a constant anyone can
recover". Say this plainly in the report — encrypting a public key protects nothing, because the
program must decrypt it in front of you.

## 5. Recover the transform, then prove it

Do not guess the cipher. Get one known plaintext (the vendor's real public key is recoverable from
any valid signed artefact, or from the decryption routine's output) and one ciphertext (the embedded
blob). Their XOR is the key stream. Then check whether the stream repeats: if the first block
equals the block following it at some offset, the transform is a repeating XOR and you have its
period.

That is not cryptanalysis, it is arithmetic, and it should be stated as such: "recovered a repeating
XOR with period N from one known plaintext" is an observation, not a break.

## 6. Replace the key: the patch

With the stream in hand, `new_ciphertext = new_public_key XOR stream`. The blob may be split
across several immediate operands in the key-loading function — patch every slice, and keep the
bytes of any trailing terminator untouched.

Two disciplines:

- **Write a genuine key pair.** Do not fabricate a "public key" that happens to satisfy the verifier
  for one message; generate a real pair so you can sign arbitrary payloads.
- **Read back from the file.** Confirm each patched slice, then confirm at runtime that the key the
  process decrypts equals your public key. The runtime check is the one that proves the patch
  mattered.

## 7. Reproduce the device binding

If the payload binds to a machine identifier, the identifier formula has to be reproduced exactly.
Look for a hash over a stable OS value, then for a presentation format: uppercase hex, grouped,
with a check character and a device-count digit.

The useful observation in the archived case is that the format is **fixed length**, so the digits
needed for the check character are always derivable — a generator never has to know the final
length before computing the parts. When a format is self-consistent like that, the binding is
weaker than it looks.

## 8. Replay the whole path, then check persistence

A code that verifies is not an activation until the client's state check passes: plan validity,
domain/workgroup match, machine identifier match, issue and expiry dates. Capture the state check's
return value and the UI reaction separately — one can be forced while the other still misbehaves.

Then the question people skip: **does it survive a restart?** In the archived case the offline path
sets memory state only, and a full IO trace showed no configuration or registry write, so the
product returns to its free tier on restart. That is a limitation of the deliverable and belongs in
the executive summary, not in a footnote.

## 9. Stop conditions

- If the verifier receives a key fetched at runtime from a server you do not control, stop: the
  client-side route is closed and the report should say so.
- If the payload is signed server-side per request, the same.
- If the format checks cannot be satisfied by construction (a checksum over an unknown secret),
  stop and report the obstruction instead of brute-forcing a space you have not bounded.

## 10. Report shape

Root cause: the client holds the verification key as replaceable data, and it decides entitlement
from a locally verified blob. Then the secondary findings: the public key is "protected" by a
reversible transform (which is not protection), the signed message is plaintext with no domain
separation, and the device binding is derivable from a stable OS value.

Remediation: keep the public key in the binary by all means — it is public — but make the *state*
authoritative. Signed entitlements should be short-lived and refreshed, offline grace should be
bounded and tamper-evident, and the machine binding should include a server-side component. Also:
stop treating key obfuscation as a security control; it costs maintenance and buys nothing.
