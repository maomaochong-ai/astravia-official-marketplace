# Defense — "the client thinks I paid" and "the service runs here" are different bugs

This package exists to keep two findings apart, and the defensive document has to do the same. One is
an entitlement decision made in a proxy DLL; the other is a *remote endpoint replaced by a local
gateway*. They fail for different reasons and they are fixed in different layers. A remediation that
addresses only one leaves the product broken in the other.

## 1. Fix the endpoint identity first

A gateway works because the client trusts a hostname and a certificate that the attacker can control.
Close that:

- **pin the issuing CA**, not just the leaf, and validate the whole chain including revocation;
- **bind the endpoint to a signed configuration** — the service address comes from a signed blob, so
  editing a config file is not enough;
- **authenticate the server to the client** with a key the attacker does not have; a shared secret in
  the binary is not that;
- **make the local-gateway case fail loudly** — a service answering with a certificate the client did
  not expect is an event worth reporting, not a warning to suppress.

A local gateway that passes every check is a product with a self-signed root in its trust store. That
is the actual defect, and no amount of predicate folding fixes it.

## 2. Then the predicates

Folding predicates at their entry is the right place to fold *defensively* too: put the authorisation
result behind one function with one implementation, and have feature code ask it rather than cache it.
Two properties make a proxy-DLL patch less rewarding:

- the value the feature needs is not derived from the predicate but from a server call the proxy
  cannot satisfy;
- the proxy's presence is observable — a module loaded from the application directory when a system
  copy exists, or a forwarder whose exports differ from the original's fingerprint.

## 3. Keep a protocol adapter honest

The gateway in this package is a protocol adapter, not a mock, which is why it works. Defensively, the
protocol is the surface: authenticate the peer, sign the responses, and reject unknown fields. A
client that accepts an unauthenticated local service is trusting the network it runs on.

## 4. What a reviewer should be able to check

- The service address is signature-verified and the verification failure is fatal for the session.
- The trust store has no local root and the client refuses a chain it did not expect.
- Feature code consults one entitlement function; no duplicated predicate chains remain.
- Loaded module fingerprints are compared against a shipped manifest.

## 5. Verifying the fix

Re-run the recorded attack twice. First with the proxy DLL only: the client should report a
verification failure or produce nothing usable. Then with the local gateway only: the client should
refuse to talk to it. Both must fail independently — that is the test that proves the two findings
were fixed as two.

## 6. Residual risk

A user who controls their machine can always run a local service. The guarantee worth stating is that
the product does not talk to it, and that the entitlement was never the client's to grant.
