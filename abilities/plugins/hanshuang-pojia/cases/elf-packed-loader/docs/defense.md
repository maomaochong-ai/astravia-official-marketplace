# Defense — the packer protects the file, and the file is not where the decision should live

Recovering a packed ELF produces a readable image and, in this package, the check that decides what
the product will do. The defensive reading is that packing bought time and nothing else, and the
question worth asking is what the recovered image contained.

## 1. Separate the two things packing is asked to do

- **Protect code from reading.** It does this, temporarily. Assume the image will be dumped and
  reviewed by someone competent eventually.
- **Protect secrets from extraction.** It does not do this at all. Anything the process needs at
  runtime is in memory at runtime, and the unpacking loop is the one place an analyst is guaranteed
  to find it.

Design accordingly: no long-lived credential in a packed section; per-session material fetched after
authentication; content keys wrapped to the device, not to the build.

## 2. Do not treat a successful unpack as a licence bypass

A dump gives an attacker a static image; making it run is a separate step and it is where a defender
can still act. Cheap, durable measures:

- **self-integrity over the mapped image**, evaluated after unpacking, with the verdict sent to the
  server rather than shown to the user;
- **import and relocation sanity checks** — a re-linked dump frequently has a different import
  ordering or an extra page, which is a signal, not proof;
- **server-side anomaly rules** — same account, same licence, many concurrent installs from images
  with different build hashes is a pattern worth alerting on.

None of these stops a determined analyst. All of them make a dumped build worth less than a
legitimate one, which is the only achievable goal.

## 3. Keep the gate out of the loader

The unpacking loop runs before the program has any policy, so anything the loader decides is decided
from constants. If the entitlement is evaluated after the image is live — from a signed blob and a
server call — then unpacking the binary yields a decision procedure but not a decision. This is the
difference between a readable client and a forgeable one.

## 4. What a reviewer should be able to check

- Entropy and import profile are consistent with the claimed protection (a "packed" binary that is
  plain is a red flag in the build pipeline, not a security win).
- The post-unpack integrity verdict reaches the server and changes authorisation.
- No API key material is present in the packed payload.
- Symbols are stripped in the packaged artefact; the loader is the only named thing left.

## 5. Verifying the fix

Dump the fixed build with the same procedure, then try to use the dump as the product. Pass condition:
the dump either will not run, or runs and is refused by the server for the gated features. A dump that
works fully means the packer was the only control and the finding stands.

## 6. Residual risk

Everything a running process knows, an analyst with a debugger knows. Packing is a delay, and a delay
is only worth its cost when the thing delayed is not the only copy of the answer.
