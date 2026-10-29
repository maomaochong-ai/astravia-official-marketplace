# Defense — what pinning actually buys, and what has to hold instead

Certificate pinning is the control this package defeats, and the honest framing is that pinning
protects the *channel*, not the *client*. Once an attacker controls the device, every pin in the
process is advisory. Treating a pin as an authorisation boundary is how products end up with a
"secure" client that hands out paid content to anyone with Frida installed.

## 1. Keep the pins, but fix what they are for

A pin still earns its place: it stops passive interception on a hostile network, and it makes a
proxy-based attack loud. Design it so it degrades rather than breaks:

- **two pins minimum** — the current key and a pre-published backup, or a CA pin plus a leaf pin, so
  a rotation does not brick the install base and an emergency rotation does not require a release;
- **pin expiry** — a build older than N months should lose trust deliberately, which bounds the
  lifetime of any extracted pin;
- **fail closed only on the gated path** — a pin failure should stop the API call, not the whole app,
  otherwise the first support ticket is "reinstall".

## 2. Do not let a client-side check carry the entitlement

If the answer to "did the pin verify?" lives in a field the feature reads, the pin is now a licence
check and it is one hook away from being bypassed — exactly as recorded in
[method.md](method.md). The server is the only party that can decide whether to hand over data, and
it must decide per request, from credentials the client cannot mint.

## 3. Add attestation where the platform offers it

Play Integrity / App Attest / DeviceCheck exist for this specific gap: they let the server ask "is
this request coming from an unmodified app on a genuine device?" without trusting the client's own
report. Use them as an input to authorisation, and be explicit in the design doc about the failure
mode — attestation has false negatives on custom ROMs, so it should raise friction or reduce rate
limits rather than hard-block a paying user.

## 4. Detection worth logging

The package's own success signal is useful in reverse. A client whose traffic starts verifying
against a proxy CA, or whose attestation verdict flips without a version change, is either being
intercepted or instrumented. Log both, keyed by account, and treat a cluster of them as an incident
rather than a support issue.

## 5. Verifying the fix

Re-run the bypass against the hardened build and check three things, in this order: the pinned call
still fails on a hostile network; the gated data is still absent when the hook reports success; and
the app remains usable when the pin check is inconclusive. A build where step 3 fails has traded a
security property for an availability problem and is not done.

## 6. Residual risk

A rooted device with a runtime hook can always make the client believe whatever it likes. The
defensible claim is that belief does not unlock data, and that the belief was expensive to fake
without leaving a server-side trace.
