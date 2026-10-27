# Work Items — cardkey-online-runtime-patch (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | live auth endpoint needs an explicit entry |
| WI-002 | Record loader facts that decide the route | lead | app | binary | todo | | DllCharacteristics, section rights, entropy, imports |
| WI-003 | Capture the authorisation exchange | lead | endpoint | web | todo | | connect/send/recv hook, command number, response magic |
| WI-004 | Pivot from the receive hook to the login handler | lead | app | runtime | todo | | recv returnAddress + two frames |
| WI-005 | Read the decision site and its success branch | lead | app | binary | todo | | the compare, not the network call |
| WI-006 | Map the post-login recheck (heartbeat) | lead | app | binary | todo | | a second decision usually hides here |
| WI-007 | Build the control matrix | lead | app | runtime | todo | | single site vs whole-function ret vs constant |
| WI-008 | Prove the minimal stable patch set | lead | app | runtime | todo | | read-back + timed run of the gated feature |
| WI-009 | Confirm the disk image is unchanged | lead | process | process | todo | | hash before/after; patches exist only in memory |
| WI-010 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 primary, transport and storage secondary |

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
- cases/cardkey-online-runtime-patch/docs/patches.md
