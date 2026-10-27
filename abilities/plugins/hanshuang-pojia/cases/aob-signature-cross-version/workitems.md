# Work Items — aob-signature-cross-version (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | declare which builds are in scope |
| WI-002 | Build the version matrix | lead | app | binary | todo | | size, checksum, image end, sections, per-section movement |
| WI-003 | Describe every site by meaning | lead | app | binary | todo | | no address without a decision it implements |
| WI-004 | Locate each site once, with disassembly | lead | app | binary | todo | | capstone/objdump evidence per site |
| WI-005 | Generate two-state signatures from ≥3 builds | lead | app | binary | todo | | intersection of builds, not one build |
| WI-006 | Prove uniqueness in both states | lead | app | binary | todo | | exactly 1 match original, 1 match patched |
| WI-007 | Resolve PE facts dynamically | lead | app | binary | todo | | checksum, DataDirectory[4], image end |
| WI-008 | Verify diff whitelist and idempotency | lead | app | binary | todo | | changed bytes ⊆ expected; second run identical |
| WI-009 | Run negative cases with zero writes | lead | app | binary | todo | | truncated section, no match, empty, non-PE |
| WI-010 | Cross-build regression on kept artefacts | lead | app | binary | todo | | new engine must not change old outputs |
| WI-011 | Write the finding and the maintenance rules | lead | report | process | todo | | why offsets rot, what replaces them |

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
- cases/aob-signature-cross-version/docs/signatures.md
- cases/aob-signature-cross-version/docs/patch-table.md
