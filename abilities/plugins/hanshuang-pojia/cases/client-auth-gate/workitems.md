# Work Items — client-auth-gate (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | |
| WI-002 | Locate candidate entitlement symbols | lead | app | binary | todo | | license/vip/pro/purchase/activation |
| WI-003 | Read the deciding function and its callers | lead | app | binary | todo | | condition, inputs, call sites |
| WI-004 | Observe the branch in a real session | lead | app | runtime | todo | | observe-mode hook + backtrace |
| WI-005 | Prove the branch is reachable and effective | lead | app | runtime | todo | | before/after run, same input |
| WI-006 | Check whether the server re-validates | lead | endpoint | web | todo | | re-check decides the severity |
| WI-007 | Write the finding with the decision point | lead | report | process | todo | | file + symbol/smali line |

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
