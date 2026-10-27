# Method — determining what an Android app pins

Hashes, class names and certificate subjects stay out of this file: they belong to the sample you
have in scope. This is the order of steps and the way to tell one pinning layer from another by
its symptom.

## 1. Enumerate before hooking

Android pins in five places, and they stack:

| Where | What you see statically |
|---|---|
| network security config | `<pin-set>` / `<trust-anchors>` in `res/xml` |
| OkHttp | `CertificatePinner` builder with `pin-sha256` |
| custom TrustManager | a class implementing `X509TrustManager` that compares the chain |
| bundled certificate | `.cer`/`.pem`/`.b64` under `assets/` or `res/raw/` |
| native | pinning in a `.so` via BoringSSL/OpenSSL calls |

`search_dex_symbols` and `decompile_android` will show the first four. The fifth shows up as
"nothing in Java pins, yet the handshake fails" — that is your signal to look at the libraries.

## 2. Use the symptom to identify the active layer

- **config-based**: fails before any app code runs; removing the pin set changes it.
- **OkHttp pinner**: throws with the host in the message; the chain is otherwise trusted.
- **TrustManager**: accepts any certificate; the failure comes from a later comparison.
- **native**: the Java stack contains no pinning frames at all.

Record which applies *before* you instrument. A hook aimed at the wrong layer produces a clean
"no crash, still blocked" result, which reads like success and is not.

## 3. Baseline, then instrument

One request, unmodified app, through the proxy: record the refusal verbatim. Then instrument and
repeat the same request. Two runs, one difference — that is the comparison the report needs.

## 4. Prove decryption, not permission

A 200 is not proof. The evidence is the response body: a field the app displays, decrypted. If
the endpoint returns a stored blob the app decrypts separately, say that too, because it changes
what the review concludes.

## 5. Write the finding as residual risk

"Pinning bypassed" is not a vulnerability; pinning is a control. The findings worth reporting are
what sits behind it:

- parameters the server does not validate (that is the real defect);
- credentials or identifiers in a body that the pin was supposed to protect;
- an app that accepts a user-installed CA on some API levels but not others.

Recommendation follows the same logic: pinning is fine as defence in depth, but nothing sensitive
should depend on it.

## 6. Two boundary statements

Both belong in every report from this precedent: whose traffic was intercepted (one app, one
scope), and that no third-party traffic was inspected even where it shared the device.
