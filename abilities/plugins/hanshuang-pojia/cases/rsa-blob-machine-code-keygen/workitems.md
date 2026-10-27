# Work Items — rsa-blob-machine-code-keygen (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | registry snapshot first |
| WI-002 | Map packaging and find the binary that owns the check | lead | app | binary | todo | | SFX stub imports no crypto |
| WI-003 | Locate the CNG blob and read its field layout | lead | app | binary | todo | | header search, not string search |
| WI-004 | Recover the request string composition | lead | app | binary | todo | | digest of each machine identifier, in order |
| WI-005 | Reconstruct the verify routine as a window scan | lead | app | binary | todo | | one 128-byte buffer, several locals |
| WI-006 | Size the modulus and bound the factor search | lead | case | crypto | todo | | record what was tried and found |
| WI-007 | Decide and record which route survives | lead | case | process | todo | | negative result is a deliverable |
| WI-008 | Patch the verify export and read back | lead | app | binary | todo | | ordinal call, status byte |
| WI-009 | Reproduce the trial clock derivation | lead | app | filesystem | todo | | timestamp key derived from a hash |
| WI-010 | Prove state survives a shell restart | lead | app | runtime | todo | | module reload, registry diff |
| WI-011 | Document anti-rollback and restore | lead | case | process | todo | | who re-applies, who restores |
| WI-012 | Write the finding, including the negative result | lead | report | process | todo | | CWE-602 primary, key-size note secondary |

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
- cases/rsa-blob-machine-code-keygen/docs/algorithm.md
