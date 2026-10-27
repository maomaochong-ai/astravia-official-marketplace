# Precedent packages

Method-level precedents shipped with the plugin. Each directory is a case shape that has already
been worked once: what the target looked like, which order of steps produced a result, and which
traps cost time.

They are **not** declarations and they contain no sample bytes, no keys and no third-party
artefacts. A precedent is a starting point you copy, not an authorisation you inherit.

Patch offsets, AOB signatures, protocol tables and algorithm constants **are** kept: they are
*derived* addresses, not sample bytes, and without them a precedent says "change the branch" and
leaves you to guess which one ([ADR 007](../docs/adr/0007-case-corpus-layer.md) D2).
The reader-facing narrative for each case lives in the document library under
`src/content/docs/cases/<slug>/`, pointed at by `caseDocs`.

| Package | Applies when |
|---|---|
| [elf-packed-loader](elf-packed-loader/README.md) | an ELF's real code only exists after unpacking |
| [apk-dex-unpack](apk-dex-unpack/README.md) | the APK's classes only exist after runtime decryption |
| [android-ssl-pin-bypass](android-ssl-pin-bypass/README.md) | the app refuses your proxy and something pins |
| [js-sign-chain](js-sign-chain/README.md) | a signed request needs the page's own signing function |
| [client-auth-gate](client-auth-gate/README.md) | a paid capability is decided in the client (CWE-602) |
| [cardkey-online-runtime-patch](cardkey-online-runtime-patch/README.md) | an online card key is decided by a packed client, and the shell never protected the running process |
| [proxy-dll-license-state-machine](proxy-dll-license-state-machine/README.md) | the UI already looks unlocked and nothing changed: the gate is a state word written on the startup path |
| [multiprocess-proxy-hotpatch](multiprocess-proxy-hotpatch/README.md) | several processes each check entitlement, and renaming a dependency breaks on the next build |
| [version-dll-proxy-iat-hook](version-dll-proxy-iat-hook/README.md) | the product loads its own version module by name and the edition is one masked integer |
| [qt-proxy-dll-gateway](qt-proxy-dll-gateway/README.md) | a Qt host imports the auth library by name, and the cloud endpoint is part of what has to move |
| [aob-signature-cross-version](aob-signature-cross-version/README.md) | a patch table has to survive the next recompile, where absolute offsets will not |
| [execryptor-vm-activation](execryptor-vm-activation/README.md) | the signature check itself is virtualised, so a keygen is off the table |
| [themida-dotnet-delegate-recovery](themida-dotnet-delegate-recovery/README.md) | a .NET client is wrapped in a protector and the real managed module only exists in memory |
| [eazfuscator-vm-minimal-patch](eazfuscator-vm-minimal-patch/README.md) | commercial obfuscation with assembly encryption, and only the entitlement flag is wanted |
| [dotnet-license-keygen](dotnet-license-keygen/README.md) | a fixed-length key is checked by string hashes and the transform has to be rebuilt exactly |
| [native-islicensed-patch](native-islicensed-patch/README.md) | one bool-returning symbol funnels every startup path through the same decision |
| [ed25519-offline-keygen](ed25519-offline-keygen/README.md) | activation is a signed blob and the verifying public key is stored inside the binary |
| [rsa-blob-machine-code-keygen](rsa-blob-machine-code-keygen/README.md) | activation is an RSA signature over a machine-derived string |
| [java-agent-dll-hijack](java-agent-dll-hijack/README.md) | the gate is a Java null check and the launcher imports native libraries from a writable directory |

## How to use one

1. Find it: `search_cases` with a signal you observed (`packed`, `frida`, `pinning`, `sign`,
   `license`), or the 「先例库」 section of the Cases page.
2. Copy the package into the workspace and rename it to your case name.
3. **Re-declare the scope.** Every shipped `scope.md` carries `auth.status: pending` on purpose:
   copy it, then run `init_task` with your own preset, `auth_status` and `in_scope` so the case
   records your authorisation rather than the package's silence.
4. Work the checklist in `workitems.md`; the order in `docs/method.md` is the part that was
   learned the hard way.

## Editing

`case.json` and the Markdown are the source. `src/domain/case/precedents.generated.ts` is
generated from them and must not be edited by hand:

```
node scripts/sync-precedents.mjs            # regenerate
node scripts/sync-precedents.mjs --check    # verify the generator ran
```

`verify:generated` runs the check together with the other generated artefacts, and the test suite
asserts that every `fieldNotes` id resolves to a real document under `src/content/docs`.
