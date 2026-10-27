# Work Items — ed25519-offline-keygen (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | code generation is the sensitive step |
| WI-002 | Locate the verify path from UI strings | lead | app | binary | todo | | dialog strings are the anchor, not the entry point |
| WI-003 | Recover the container format | lead | app | binary | todo | | version char, check char, base64 body |
| WI-004 | Confirm the signature scheme and the signed message | lead | app | runtime | todo | | message is the decompressed payload |
| WI-005 | Trace where the public key is loaded from | lead | app | binary | todo | | embedded blob, decrypted at runtime |
| WI-006 | Recover the key stream and prove its period | lead | app | binary | todo | | XOR with known plaintext |
| WI-007 | Generate a key pair and re-encrypt the public half | lead | case | crypto | todo | | private half stays in the case directory |
| WI-008 | Patch every copy of the blob and read back | lead | app | binary | todo | | one blob, several immediate loads |
| WI-009 | Reproduce the machine code formula | lead | app | binary | todo | | fixed-length format is constructible |
| WI-010 | Sign a payload and replay the full client path | lead | app | runtime | todo | | format, decompress, verify, state check |
| WI-011 | Establish persistence behaviour | lead | app | filesystem | todo | | in-memory only is a finding, not a bug |
| WI-012 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 / CWE-321 / key handling |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
- cases/ed25519-offline-keygen/docs/algorithm.md
