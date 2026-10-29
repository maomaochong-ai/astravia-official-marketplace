# Defense — an offline key check has to be a signature, and the signer has to stay home

This package reconstructs a local key check and produces keys the client accepts. That is possible
for exactly one reason: the material needed to verify was also sufficient to produce. Any offline
scheme whose check can be reimplemented from the binary is a scheme with a public mint.

## 1. Asymmetric, always, and one direction only

Offline verification requires the verifier's key to be in the binary, so it must be a **public** key
and the scheme must be a signature, not a MAC:

- Ed25519 or RSA-PSS over a canonical serialisation of the licence fields;
- the signed message must include product id, edition, issue date, expiry and a device or account
  binding — a blob that only names the customer is replayable across products;
- the private key never leaves the build system; if a key ever shipped, rotate it and treat every
  licence signed with it as compromised.

A symmetric check — anything where the client holds the same secret it verifies with — is the defect
this package demonstrates. It does not matter how the constant is hidden.

## 2. Make the blob expensive to reuse

Signatures prevent minting; they do not prevent copying. Add, in order of value:

- **account binding** with a server call at activation, so the blob is tied to an identity;
- **device binding** where the platform supports a keystore/TPM-backed key, signing a challenge;
- **short expiry with silent renewal while online**, so a leaked blob dies on schedule;
- **revocation** — a server-side list checked whenever the client is online. Without it, a leaked
  blob lives as long as the product does.

## 3. Keep the check in one place, and check the check

[method.md](method.md) shows the reconstruction succeeding because the verifier is a small,
single-purpose routine. Defensively, that is fine — it should be small — but it must be *the only*
path, and the result must not be a global that any other code can set. Two implementation details
that catch real incidents: derive the entitlement from the verified payload each time it is needed,
and assert at startup that the verified payload's product id matches the running product.

## 4. What a reviewer should be able to check

- The public key in the binary matches the one in the build system's records, by fingerprint.
- No private key material appears in any shipped artefact (grep the build output for its prefix).
- The licence format is versioned and the verifier rejects unknown versions instead of ignoring them.
- Clock rollback is detected (monotonic counter, last-seen timestamp stored server-side).

## 5. Verifying the fix

Take the keygen produced by this package's method and run it against the hardened build. Two
outcomes are acceptable: the key is rejected, or the key is accepted locally and the product still
refuses to deliver because the server never issued an entitlement. Anything else means the local check
is still the authority.

## 6. Residual risk

Offline products cannot prevent a user from running a patched verifier. What they can guarantee is
that no third party can produce a licence that a *stock* client accepts, and that a copied licence
does not survive an account or device change.
