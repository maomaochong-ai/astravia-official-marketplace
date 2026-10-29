# Defense — a packer cannot hide code from the JIT

This package audits a protected managed client without unpacking it on disk, by rebuilding the module
in memory and hooking the vtable the packer already hooked. The technique is instructive for a
defender because it shows the boundary of the protection: managed code must exist in a readable form at
the moment it is compiled, and anything that must be readable can be read.

## 1. Stop protecting managed code with a native packer

A packer over a managed assembly buys delay against static tools and nothing against a runtime. If the
CLR runs the code, the code is recoverable in memory. Design decisions that follow:

- **do not put the entitlement decision in managed code** if it is meant to be secret; move it to a
  server call whose answer is a signed claim;
- do not put keys in a protected assembly — a per-session key released after authentication is the
  only version that survives the technique in [method.md](method.md);
- do not rely on "the interesting assembly is not the one on disk"; assume the in-memory module is
  exactly what an analyst will read.

## 2. Detect the in-memory rebuild instead

The route depends on modifying the process: hooking a delegate vtable, repointing a method table,
reflecting into a rebuilt module. Those are observable:

- compare delegate targets and method-table pointers against the shipped image at intervals;
- verify that the number of loaded modules and their sizes match the manifest;
- treat a module whose PE header exists only in memory as an event worth reporting (with a tolerance
  for legitimate dynamic compilation, which should be enumerated in the design);
- report verdicts to the server and let authorisation depend on them, rather than showing a dialog.

## 3. Keep the protected layers where they earn their cost

Renaming and control-flow obfuscation of *protocol and key-derivation* code still raise the cost of
understanding the service. That is where the budget belongs. Wrapping an entitlement check in a packer
produces exactly the artefact this package documents: a client that can be fully reconstructed and a
decision that was local all along.

## 4. What a reviewer should be able to check

- No managed assembly contains long-lived credentials; grep the build output for key prefixes.
- The entitlement arrives as a signed claim from the server and is verified at each use.
- Integrity observations reach the server, with a defined action on failure.
- Dynamic compilation is enumerated and anything outside the list is reported.

## 5. Verifying the fix

Reproduce the in-memory rebuild, then force the decision it exposes. Pass condition: the recorded
capability stays unavailable after forcing, because the client's belief was never sufficient. A build
where forcing the rebuilt decision unlocks the product has moved the protection, not removed the
defect.

## 6. Residual risk

Managed code running on a user's machine is readable while it runs. The honest control is that reading
it yields no reusable credential and no authority the server honours.
