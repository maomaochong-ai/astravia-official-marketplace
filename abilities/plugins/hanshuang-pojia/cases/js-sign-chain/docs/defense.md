# Defense — a signing key in the browser is a public key, whatever it is called

This package reproduces a browser-side signing chain and then asks the only question that matters:
what does holding that secret buy? For the defender, the same question applied to their own product
decides whether their request signing is a control or a ritual.

## 1. Accept that the algorithm is public

Anyone can read the bundle, set a breakpoint, and call the signer with their own inputs. Therefore:

- the signing function must not be the thing that decides whether a request is allowed;
- the secret it uses must assume exposure — rotate it, scope it, and never reuse it as an API key;
- a signature must be bound to something the client cannot choose, or it is a checksum, not an
  authorisation.

## 2. Make the signature a short-lived proof, not a credential

The patterns that survive an extracted secret:

- **server-issued nonce** in the signed message, single-use, with a short window — this defeats
  replay even when the signer is fully reproduced;
- **session token**: the signing secret derives a per-session key after login, so an extracted static
  secret only forges requests inside its own session;
- **server-side rate limits and anomaly rules** keyed by account, so a replayed chain shows up as
  volume rather than as a valid request;
- **device or origin attestation** folded into the signed payload where the platform supports it.

A request signature with none of these is obfuscation. Say so in the design review rather than
listing it as a security control.

## 3. Bound the blast radius of the secret

If the same secret signs every endpoint, one extraction is total. Scope it: per-endpoint derivations,
per-version rotation, and a kill switch that invalidates a leaked secret without a client release.
Track which builds contain which secret so the rotation can be targeted.

## 4. What a reviewer should be able to check

- The signed message includes a server nonce and a timestamp the server validates.
- Replaying a captured request fails, and the failure is distinguishable from a bad body.
- The signing secret differs per environment and never appears in a public source map.
- No authorisation decision depends on the presence of a valid signature alone.

## 5. Verifying the fix

Take the reproduction from this package, run it against the hardened endpoint, and then replay the
same request. The first attempt should succeed exactly as often as the server's nonce policy permits;
the second must fail. If both succeed, the signature is still the whole control.

## 6. Residual risk

A browser will always be able to sign what the user's browser can sign. The achievable guarantee is
that signing a request does not create authority — the session, the account and the server's own
policy do.
