# Android TLS pinning review — precedent

The proxy is installed, the certificate is in the trust store, and the app still refuses to talk.
Something pins. The job is to establish **what** is pinned, confirm it at runtime, and say what
that does and does not protect.

## When this precedent applies

- `SSLHandshakeException`, `CertificatePinner`, `TrustManagerImpl` or a pinning error in logcat;
- `network_security_config.xml` with `<pin-set>` entries;
- a bundled certificate in `assets/` or `res/raw/`;
- traffic works in the browser and fails only in the app.

## Shape of the work

1. `triage_binary` + `search_dex_symbols` for `CertificatePinner`, `TrustManager`, `X509`,
   `sslSocketFactory`, `pin-sha256` — enumerate the layers before touching any.
2. `decompile_android` and read the pinning setup: OkHttp `CertificatePinner`, a custom
   `TrustManager`, or a network-security-config. Note which, and for which hosts.
3. Hook at runtime (`generate_hook`) with a backtrace so you learn which layer actually throws.
   Layers stack: bypassing the first one only reveals the second.
4. Re-test the same request through the proxy against the unmodified app first, to record the
   baseline refusal, then against the instrumented session.
5. Report what the pinning protects and what the app still trusts.

## Traps

- Blindly applying a public bypass script. It targets one of five common layers and silently does
  nothing about the rest.
- Assuming every failure is pinning: a client certificate or an mTLS requirement looks the same.
- Patching the APK when a runtime hook proves the same thing with less risk.
- Reporting "pinning bypassed" as a vulnerability. Pinning is a defence; the finding is usually
  what it fails to protect — an under-protected endpoint, or credentials in the clear elsewhere.

## Evidence you must be able to show

The pinning layer (class/method/config file), the baseline failure, the same request succeeding
under instrumentation, and the endpoint content that proves the session was decrypted rather
than merely unblocked.
