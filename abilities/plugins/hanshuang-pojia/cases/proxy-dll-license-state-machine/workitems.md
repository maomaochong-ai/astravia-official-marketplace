# Work Items — proxy-dll-license-state-machine (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | local target, but authorisation still has to be recorded |
| WI-002 | Image profile and import table | lead | app | binary | todo | | zero network APIs is the finding that frames everything |
| WI-003 | Enumerate candidate authorisation globals | lead | app | binary | todo | | level int, coverage flag, state word, string pointers |
| WI-004 | Rank candidates by cross-reference count | lead | app | binary | todo | | most readers = UI mirror; single writer = state machine |
| WI-005 | Read the writer block | lead | app | binary | todo | | load, transform, store — this is the gate |
| WI-006 | Enumerate the downgrade write sites | lead | app | binary | todo | | early-failure branches that re-mark trial |
| WI-007 | Build the three-observer scenario table | lead | app | runtime | todo | | in-process values + title + about panel |
| WI-008 | Patch producer, then fallbacks, one at a time | lead | app | runtime | todo | | re-observe between sites |
| WI-009 | Prove the revert leg | lead | app | process | todo | | trial state returns, no residue |
| WI-010 | Confirm image and signature untouched | lead | process | process | todo | | hash + Authenticode before/after |
| WI-011 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 primary; hardening layers secondary |

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
- cases/proxy-dll-license-state-machine/docs/state-machine.md
