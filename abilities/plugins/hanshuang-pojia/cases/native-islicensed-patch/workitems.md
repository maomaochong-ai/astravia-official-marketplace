# Work Items — native-islicensed-patch (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | record authorisation before the first write |
| WI-002 | Snapshot the artefact and its hash | lead | app | binary | todo | | patch a copy; the original hash is the baseline |
| WI-003 | Enumerate symbols and pick the gate | lead | app | binary | todo | | name, VA, file offset, byte range |
| WI-004 | Find every caller of the gate | lead | app | binary | todo | | two calls at startup is the normal case |
| WI-005 | Read the function body for state writes | lead | app | binary | todo | | what breaks if the body never runs |
| WI-006 | Patch the entry with a return stub | lead | app | binary | todo | | original vs patched bytes, then read-back |
| WI-007 | Prove the gate is single | lead | app | runtime | todo | | restart; look for a second refusal |
| WI-008 | Run the branch comparison | lead | app | runtime | todo | | unpatched vs patched, same input, branch log |
| WI-009 | Map persistence and anti-rollback | lead | app | filesystem | todo | | run key / task / guard that re-applies |
| WI-010 | Verify restart persistence and stability | lead | app | runtime | todo | | gated feature exercised, not just a window |
| WI-011 | Write rollback and the finding | lead | report | process | todo | | restore bytes, remove persistence, CWE-602 |

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
- cases/native-islicensed-patch/docs/patch-and-guard.md
