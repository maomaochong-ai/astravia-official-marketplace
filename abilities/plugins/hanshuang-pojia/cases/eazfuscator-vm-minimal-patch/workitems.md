# Work Items — eazfuscator-vm-minimal-patch (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes a `E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | commercial target; sample stays pristine |
| WI-002 | Enumerate protection layers and pick a route per layer | lead | app | binary | todo | | the table is the plan |
| WI-003 | Decompile after renaming and dump the string table | lead | app | process | todo | | reflect the client's own decryptor, one process per variant |
| WI-004 | Reproduce the section keystream and prove byte-exact re-encryption | lead | app | binary | todo | | key derives from other sections' content hash |
| WI-005 | Separate the virtualisation container from the gate | lead | app | binary | todo | | do not start with the VM |
| WI-006 | Read the entitlement as IL: predicate plus flag writes | lead | app | binary | todo | | 4 flags, 8 call sites in the source engagement |
| WI-007 | Locate the credential check and classify its empty-input branch | lead | app | binary | todo | | fail-open ⇒ what does it actually grant? |
| WI-008 | Enumerate client-readable state the client treats as entitlement | lead | app | file | todo | | registry booleans; CWE-863 |
| WI-009 | Build the patch tool with three profiles and byte verification | lead | app | binary | todo | | control / recommended / complete |
| WI-010 | Observe the predicate per profile in a runtime probe | lead | app | process | todo | | `False` → `True`, and what the UI shows |
| WI-011 | Prove the patched file differs only at the listed sites | lead | app | binary | todo | | byte-diff against the pristine sample |
| WI-012 | Write the report: orthogonal protection vs architecture | lead | report | process | todo | | rank findings by what they grant |

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
- cases/eazfuscator-vm-minimal-patch/docs/protection-layers.md
