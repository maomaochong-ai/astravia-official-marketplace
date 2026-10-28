# Defense — four processes, one decision, and a proxy in each

The patch set in this package exists because the same authorisation decision is independently
implemented in every process of a suite, and each one can be reached by injecting a proxy DLL. The
defensive lesson is structural: **duplicating a check multiplies the number of places that must be
correct, and the attacker only needs one wrong.**

## 1. Centralise the decision, then distribute the token

A multi-process design should have one authorisation service and every other process should hold a
verifiable token from it. Two consequences, both of which are cheap to build:

- the background daemon, the push service and the UI verify the *same* signed token with the *same*
  routine, so a single patched verification is a single patched routine and is detectable;
- the server accepts work only with a token it issued, so a locally-elevated process asks the server
  for something it will not get.

If instead each process re-derives `isPro` from a registry value, the attacker patches the cheapest
reader and the suite behaves as if licensed.

## 2. Choose the delivery boundary on purpose

The recorded method picks the injection point by import table. That is also the defender's map:
every DLL a process imports by name is a file an attacker can replace if the directory is writable.
Mitigations that actually apply:

- ship every imported module with a signature and verify the loaded module's signature at startup;
- avoid loading from the application directory when a system copy exists (or use a manifest that
  pins the search order);
- prefer static linking or a single signed bundle where the licence permits;
- treat "module loaded from an unexpected path" as an alert, since it is also the shape of a
  legitimate hotfix.

## 3. Verification before deployment, not after

The method insists on a synthetic host before touching the installation, and on a stated write scope.
Build the same discipline into the product's own tooling: any internal patching mechanism should
refuse when the target build's size, checksum or section table differs, and it should log the refusal.
A tool that "tries anyway" is how support incidents become outages.

## 4. What a reviewer should be able to check

- One authorisation routine, referenced by every process, with a single implementation.
- Each process can state which server-issued token it holds and when it expires.
- Loaded modules are signature-verified, and the check is not optional on the gated paths.
- The install directory is not user-writable by the account that runs the suite.

## 5. Verifying the fix

Replay the patch set site by site. Expect most sites to lose their effect because the value they
write is verified elsewhere, and expect at least one site to produce a server-side rejection. Roll
back afterwards — the package's own step 8 exists because a verification run that cannot be undone is
not a verification run.

## 6. Residual risk

A user with write access to the install directory can still replace a module. The guarantees worth
stating are that the replacement is detected, that detection changes server behaviour, and that a
single replaced module does not grant the whole suite.
