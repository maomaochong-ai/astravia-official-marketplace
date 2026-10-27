# Work Items — execryptor-vm-activation (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | remote auth service must stay out of scope |
| WI-002 | Triage both binaries and their relationship | lead | app | binary | todo | | main program + helper runtime, versions, imports |
| WI-003 | Rule in or out a local cryptographic check | lead | app | binary | todo | | import surface is the evidence |
| WI-004 | Recover the readable call chain from strings | lead | app | binary | todo | | dialog → manager → verify wrapper |
| WI-005 | Map the IPC channel | lead | app | runtime | todo | | shared memory size, event pair, mutex, payload |
| WI-006 | Confirm the verifier is virtualised | lead | app | binary | todo | | dispatch loop over bytecode, not recoverable |
| WI-007 | Locate the status → decision comparison | lead | app | binary | todo | | one integer against a small constant |
| WI-008 | Read the success branch to its end | lead | app | binary | todo | | registry values, type normalisation, struct clear |
| WI-009 | Build and verify the stub redirect | lead | app | binary | todo | | original bytes, stub bytes, read-back |
| WI-010 | Verify both entry points after the patch | lead | app | runtime | todo | | interactive activate and start-up check differ |
| WI-011 | Enumerate side effects screen by screen | lead | app | runtime | todo | | empty fields are not a failed patch |
| WI-012 | Write the finding: no keygen path, fix the authority | lead | report | process | todo | | service-side signing is the remediation |

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
- cases/execryptor-vm-activation/docs/ipc.md
- cases/execryptor-vm-activation/docs/verdict.md
