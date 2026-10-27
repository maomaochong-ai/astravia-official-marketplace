# Work Items — qt-proxy-dll-gateway (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes a `E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | commercial target; official binaries stay pristine |
| WI-002 | Inventory the host's imports from the auth library | lead | app | binary | todo | | by name? count? complete coverage? |
| WI-003 | Extract the feature enum from framework metadata | lead | app | binary | todo | | Qt meta-object strings, not guessed from UI |
| WI-004 | Map every privilege predicate and its call sites | lead | app | binary | todo | | predicates vs call sites: two different numbers |
| WI-005 | Build the forwarder proxy and prove the host loads it | lead | app | process | todo | | export table generated from the official library |
| WI-006 | Constant-fold the predicates and record the patch table | lead | app | process | todo | | entry-only patches; note ICF folds |
| WI-007 | Locate the endpoint constant and its length/displacement | lead | app | binary | todo | | string slot, `mov` imm, `lea` disp |
| WI-008 | Stand up a local gateway that speaks the client's protocol | lead | endpoint | web | todo | | translate + transparent pass-through |
| WI-009 | Prove the client reaches the gateway and gets an answer | lead | app | web | todo | | transcript with one configured backend |
| WI-010 | Fold the cloud-control and update paths | lead | endpoint | web | todo | | count requests to the vendor host before/after |
| WI-011 | Revert and verify official hashes | lead | app | binary | todo | | kill process family, restore, remove artefacts |
| WI-012 | Write the finding with root cause and layered fix | lead | report | process | todo | | CWE-602 primary; transport and signing secondary |

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
- cases/qt-proxy-dll-gateway/docs/pitfalls.md
