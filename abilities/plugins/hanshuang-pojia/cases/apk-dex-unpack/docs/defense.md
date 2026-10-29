# Defense — packing is anti-reading, so stop shipping things worth reading

The package recovers sources from a packed APK, and the lesson for a defender is narrower than
"obfuscate better". Packing delays source recovery; it does not stop the code from running, and every
secret the code needs at runtime is therefore present at runtime. Once that is accepted, the design
questions become answerable.

## 1. Decide what is actually secret

Three different things get packed as if they were the same:

- **algorithms** — never secret. A recovered implementation is a documentation problem, not a breach;
- **keys and endpoints** — secret in the sense that they must not be extractable, which means they
  must not be in the package at all if their exposure matters;
- **policy decisions** (is this user entitled, is this content allowed) — must not be decided in the
  package, because the package is running on hardware the attacker controls.

Only the second and third justify the cost of a packer, and the third cannot be solved by one.

## 2. Move the key, not the code

If a client decrypts content, the key has to reach the client, and a dump will eventually reach it
too. The defensible patterns:

- **per-session keys** issued after an authenticated call, valid for one asset and a short window;
- **key wrapping bound to the device** so a copied key does not work on another install;
- **server-side rendering or streaming** for the highest-value assets, where the client never holds
  plaintext.

A static key inside `assets/` is a design decision to publish that asset to anyone who dumps the APK.
Say so in the threat model rather than treating the packer as the control.

## 3. Make unpacking cost something, and log it

Loader detection, `DexClassLoader` naming and native stub presence are all observable from outside.
Legitimate builds can prove they are unmodified — Play Integrity, or a signature check against a
server-issued nonce — and a client that fails that proof should be treated as untrusted for the
gated paths. The point is not to defeat the dump; it is to make the dumped build worth less than the
original.

## 4. What a reviewer should be able to check

- Every string in `assets/` and `lib/<abi>/` is accounted for; none is a long-lived credential.
- No API secret is used directly by the client (search for the provider's key format).
- The loader class contains no policy logic; it only loads.
- Integrity verdicts are evaluated server-side and expire.

## 5. Verifying the fix

Dump the fixed build with the same procedure as [method.md](method.md) describes, then ask what the
dump buys: a reader gets the algorithm (acceptable), an endpoint (acceptable if the endpoint
authenticates), and a key (not acceptable). If the third answer is yes, the packer is carrying a
security property it cannot carry.

## 6. Residual risk

Anyone who can run the app can read the code eventually. The claim worth making in the report is
that reading the code does not yield credentials, and that copied credentials do not survive a
device change.
